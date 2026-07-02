// Core Node.js modules
const fs = require('fs');
const path = require('path');

// External libraries
const moment = require('moment-timezone');
const crypto = require('crypto');

// Constants
const PUBLIC_DIR = path.join(__dirname, 'public');


// sdrtrunk stamps filenames in the capture host's LOCAL time, so parse them as
// local (via the multi-arg Date constructor). This is the single source of
// truth for filename->Date shared by the home-page filter and the notifier
// (checkTranscriptions.js), keeping them from drifting apart.
function parseLocalTimestamp(ts) {
    const m = String(ts).match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}


function isWithinDateRange(fileName, startDate, endDate) {
    let fileDateTime = parseLocalTimestamp(fileName);
    if (!fileDateTime) return false;

    if (startDate && fileDateTime < startDate) return false;
    if (endDate && fileDateTime > endDate) return false;

    return true;
}


function extractDateFromFilename(fileName) {
    // if the filename has no timestamp, return a default old date
    return parseLocalTimestamp(fileName) || new Date(0);
}

const formatDate = (dateObj) => moment(dateObj).format('YYYY-MM-DD');
const formatTime = (dateObj) => moment(dateObj).format('HH:mm');

const filterAndSortAudioFiles = (files, selectedRadioIds, selectedTalkgroupIds, startDate, endDate, dir) => {
    return files
        .filter(file => {
            // Check if the file is an MP3 file
            if (!file.endsWith('.mp3')) return false;

            // Extract the radio ID from the filename, if present
            const radioIdMatch = file.match(/FROM_(\d+)\.mp3/);
            const radioId = radioIdMatch ? radioIdMatch[1] : 'Unknown';

            // Check if the file is within the selected date range
            if (!isWithinDateRange(file, startDate, endDate)) return false;

            // Check if the radio ID and talkgroup ID match the selected filters
            const isRadioIdSelected = selectedRadioIds.includes('') || selectedRadioIds.includes(radioId);
            const isTalkgroupIdSelected = selectedTalkgroupIds.includes('') || selectedTalkgroupIds.includes(dir);

            return isRadioIdSelected && isTalkgroupIdSelected;
        })
        .sort((a, b) => extractDateFromFilename(b) - extractDateFromFilename(a));
};


const getQueryParams = (req) => ({
    selectedRadioIds: req.query.radioIds ? [req.query.radioIds] : [''],
    selectedTalkgroupIds: req.query.talkgroupIds ? [req.query.talkgroupIds] : [''],
    userSelectedTheme: req.query.theme || req.cookies.theme || 'gray',
    autoRefreshEnabled: req.query.autoRefresh === 'true',
    refreshRate: req.query.refreshRate ? parseInt(req.query.refreshRate, 10) : 5
});

const getDefaultDateTime = () => {
    const now = moment().tz("America/New_York");
    const eightHoursAgo = now.clone().subtract(2, 'hours');
    const tomorrow = moment().add(1, 'days');
    return {
        defaultStartDate: formatDate(eightHoursAgo),
        defaultStartTime: formatTime(eightHoursAgo),
        defaultEndDate: formatDate(tomorrow),
        defaultEndTime: formatTime(tomorrow)
    };
};

const processDirectory = async (dir, selectedRadioIds, selectedTalkgroupIds, startDate, endDate) => {
    const dirPath = path.join(PUBLIC_DIR, 'audio', dir);
    const files = await fs.promises.readdir(dirPath);
    const audioFiles = filterAndSortAudioFiles(files, selectedRadioIds, selectedTalkgroupIds, startDate, endDate, dir);
    const transcriptions = [];

    for (const file of audioFiles) {
        const transcriptionPath = path.join(PUBLIC_DIR, 'transcriptions', dir, file.replace('.mp3', '.txt'));
        const transcription = fs.existsSync(transcriptionPath) ? await fs.promises.readFile(transcriptionPath, 'utf-8') : "Transcription not found";
        transcriptions.push({
            id: dir,
            audio: `/public/audio/${dir}/${file}`,
            transcription,
            timestamp: extractDateFromFilename(file)
        });
    }

    return transcriptions;
};

// Generate a cryptographically secure confirmation ID
const generateConfirmationId = () => {
    return crypto.randomBytes(24).toString('hex');
};

// Escape untrusted text before interpolating into HTML markup or attributes
const escapeHTML = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

module.exports = {
    isWithinDateRange,
    extractDateFromFilename,
    formatDate,
    formatTime,
    filterAndSortAudioFiles,
    getQueryParams,
    getDefaultDateTime,
    processDirectory,
    generateConfirmationId,
    escapeHTML,
    parseLocalTimestamp
};
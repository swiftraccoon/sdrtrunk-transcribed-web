const moment = require('moment-timezone');
const path = require('path');
const PUBLIC_DIR = path.join(__dirname, 'public');
const fs = require('fs');


function isWithinDateRange(fileName, startDate, endDate) {
    let dateMatch = fileName.match(/(\d{4}\d{2}\d{2})_(\d{2}\d{2}\d{2})/);
    if (!dateMatch) return false;

    let fileDateTimeStr = `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}T${dateMatch[2].slice(0, 2)}:${dateMatch[2].slice(2, 4)}:${dateMatch[2].slice(4, 6)}Z`;
    let fileDateTime = new Date(fileDateTimeStr);

    if (startDate && fileDateTime < startDate) return false;
    if (endDate && fileDateTime > endDate) return false;

    return true;
}


function extractDateFromFilename(fileName) {
    let dateMatch = fileName.match(/\d{4}\d{2}\d{2}_\d{2}\d{2}\d{2}/);
    if (!dateMatch) return new Date(0); // if the filename does not have a date, return a default old date

    let fileDateStr = dateMatch[0].slice(0, 4) + '-' + dateMatch[0].slice(4, 6) + '-' + dateMatch[0].slice(6, 8) + 'T' + dateMatch[0].slice(9, 11) + ':' + dateMatch[0].slice(11, 13) + ':' + dateMatch[0].slice(13, 15) + 'Z';
    return new Date(fileDateStr);
}

const formatDate = (dateObj) => moment(dateObj).format('YYYY-MM-DD');
const formatTime = (dateObj) => moment(dateObj).format('HH:mm');

const filterAndSortAudioFiles = (files, selectedRadioIds, selectedTalkgroupIds, startDate, endDate, dir) => {
    //console.log("Selected Talkgroup IDs: ", selectedTalkgroupIds);  // Debug log

    return files
        .filter(file => {
            const radioIdMatch = file.match(/FROM_(\d+)\.mp3/);
            if (!radioIdMatch) return false;
            const radioId = radioIdMatch[1];

            try {
                return (selectedRadioIds.includes('') || selectedRadioIds.includes(radioId)) &&
                    (selectedTalkgroupIds.includes('') || selectedTalkgroupIds.includes(dir)) &&  // Check this line
                    file.endsWith('.mp3') &&
                    isWithinDateRange(file, startDate, endDate);
            } catch (error) {
                console.error("Error in filterAndSortAudioFiles: ", error);  // Error handling
                return false;
            }
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

// Generate a unique confirmation ID (implement this function)
const generateConfirmationId = () => {
    return Math.random().toString(36).substring(2, 15);
};

module.exports = {
    isWithinDateRange,
    extractDateFromFilename,
    formatDate,
    formatTime,
    filterAndSortAudioFiles,
    getQueryParams,
    getDefaultDateTime,
    processDirectory,
    generateConfirmationId
};
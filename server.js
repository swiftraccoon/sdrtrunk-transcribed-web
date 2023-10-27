// Import modules
const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone');
const path = require('path');
const basicAuth = require('express-basic-auth');
const cookieParser = require('cookie-parser');
const { isWithinDateRange, extractDateFromFilename } = require('./utility');
const searchTranscriptions = require('./search');


// Constants
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const users = { 'user': 'pass' };
const idDescriptionMap = {
    '41001': 'EMS',
    '41002': 'Fire Dept',
    '': 'No Filter',
};
const radio_id_names = {
    "1610018": "EMS CAD",
    "1610019": "FD CAD",
    "": "No Filter",
};



// Initialize app
const app = express();
app.use(cookieParser());


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



// Middleware
app.use(basicAuth({
    users: users,
    challenge: true,  // Will display a pop-up asking for username/password
    realm: 'hi',
    unauthorizedResponse: 'hihi'
}));
app.use('/public', express.static(PUBLIC_DIR));



// Route handlers
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

app.get('/', async (req, res) => {
    const { selectedRadioIds, selectedTalkgroupIds, userSelectedTheme, autoRefreshEnabled, refreshRate } = getQueryParams(req);

    if (req.query.theme) {
        res.cookie('theme', req.query.theme);
    }

    const { defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime } = getDefaultDateTime();

    const startDate = req.query.startDate_date && req.query.startDate_time
        ? new Date(`${req.query.startDate_date}T${req.query.startDate_time}Z`)
        : new Date(`${defaultStartDate}T${defaultStartTime}Z`);

    const endDate = req.query.endDate_date && req.query.endDate_time
        ? new Date(`${req.query.endDate_date}T${req.query.endDate_time}Z`)
        : new Date(`${defaultEndDate}T${defaultEndTime}Z`);

    const dirs = await fs.promises.readdir(path.join(PUBLIC_DIR, 'audio'));
    const transcriptionsList = await Promise.all(dirs.map(dir => processDirectory(dir, selectedRadioIds, selectedTalkgroupIds, startDate, endDate)));
    const flattenedTranscriptions = transcriptionsList.flat();

    flattenedTranscriptions.sort((a, b) => b.timestamp - a.timestamp);

    res.set('Cache-Control', 'no-store');
    res.send(renderHTML(flattenedTranscriptions, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime, selectedRadioIds, selectedTalkgroupIds, userSelectedTheme));
});



app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.send('No query provided');
    }

    const results = await searchTranscriptions(query);
    res.send(results);
});



// HTML rendering function
function renderHTML(transcriptions, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime, selectedRadioIds, selectedTalkgroupIds, theme) {
    const themeCSSLink = {
        gray: "http://sdr.spindale.host:3000/public/gray.css",
        darkGray: "http://sdr.spindale.host:3000/public/darkGray.css",
        ultraDark: "http://sdr.spindale.host:3000/public/ultraDark.css"
    }[theme] || "http://sdr.spindale.host:3000/public/gray.css"; // Use gray theme as default if theme is undefined or not matching.    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SDR Transcriptions</title>
            <link rel="stylesheet" href="${themeCSSLink}">
        </head>
        <body>
        <!-- Title header -->
        <center><h3><a href="https://www.broadcastify.com/calls/node/2577">Node 2577: North Carolina VIPER</a><br /></h3>
        <!-- Search Box -->
        <div class="search-box">
        <form action="/search" method="get">
            <input type="text" name="q" placeholder="Search transcriptions...">
            <button type="submit">Search</button>
        </form>
        </div><br />
               <form action="/" method="get">
                    <!-- Theme selector -->
                    <div style="display: inline-block; vertical-align: top; border-right: 2px solid #444; padding-right: 10px; margin-right: 10px;">
                        <label for="themeSelector">Theme:</label>
                        <select name="theme">
                            <option value="gray" ${theme === 'gray' ? 'selected' : ''}>Gray</option>
                            <option value="darkGray" ${theme === 'darkGray' ? 'selected' : ''}>Dark Gray</option>
                            <option value="ultraDark" ${theme === 'ultraDark' ? 'selected' : ''}>Ultra Dark</option>
                        </select>
                    </div>
                    <!-- Special text -->
                    <div style="display: inline-block; vertical-align: top; border-right: 2px solid #444; padding-right: 10px; margin-right: 10px;">
                        <input type="checkbox" id="specialTextToggle">
                    </div>
                    <!-- Auto-refresh -->
                    <div style="display: inline-block; vertical-align: top; ">
                        <input type="checkbox" id="autoRefreshCheckbox" name="autoRefresh" value="true">
                        <input type="number" id="refreshInterval" name="refreshRate" min="1" max="60" value="5" style="width: 15px;"> minutes
                    </div>
                    <button type="submit">Apply</button>
                </form>
                </center>
            <!-- Broadcastify Links -->
            <div class="transcription">
                <button class="collapsible">Broadcastify Links</button>
                    <div class="collapsed">
                        <a href="https://www.broadcastify.com/calls/tg/7118/41001">41001:RuCoEMS</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/41002">41002:RuCoFD</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/41003">41003:RuCoSD</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/41013">41013:RPD</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/41020">41020:FCPD</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/51583">51583:MRTS/Statewide</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/52198">52198:NCSHP/TroopG/Dist2</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/52201">52201:NCSHP/TroopG/Dist5</a> <br />
                        <a href="https://www.broadcastify.com/calls/tg/7118/52540">52540:RthfdHosVMF5/VMN</a> <br />
                        Transcriptions that fall under group P are due to multiple talkgroups (almost always NCSHP)
            </div>
                <div class="transcription">
                    <div class="content">
                        <form method="GET">
                            <!-- Date Selector -->
                            <div class="flex-container">
                                <div style="display: inline-block; vertical-align: top; border-right: 2px solid #444; padding-right: 10px; margin-right: 10px;">
                                    <div class="flex-item">
                                        <div class="label-container">
                                            <label for="startDate">Start:</label>
                                        </div>
                                        <div class="selector-container">
                                            <input type="date" name="startDate_date" value="${defaultStartDate}">
                                            <input type="time" name="startDate_time" value="${defaultStartTime}">
                                        </div>
                                    </div>
                                    <div class="flex-item">
                                        <div class="label-container">
                                            <label for="endDate">End:</label>
                                        </div>
                                        <div class="selector-container">
                                            <input type="date" name="endDate_date" value="${defaultEndDate}">
                                            <input type="time" name="endDate_time" value="${defaultEndTime}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex-container">
                                <div style="display: inline-block; vertical-align: top;">
                                    <!-- Radio ID Selector -->
                                    <div class="flex-item">
                                        <div class="label-container">
                                            <label for="radioIds">RID:</label>
                                        </div>
                                        <div class="selector-container">
                                            <select name="radioIds" id="radioIds">
                                                ${Object.keys(radio_id_names).map(radioId => {
        let isSelected = selectedRadioIds && selectedRadioIds.includes(radioId) ? 'selected' : '';
        return `<option value="${radioId}" ${isSelected}>${radio_id_names[radioId]}</option>`;
    }).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <!-- Talkgroup ID Selector -->
                                    <div class="flex-item">
                                        <div class="label-container">
                                            <label for="talkgroupIds">TGID:</label>
                                        </div>
                                        <div class="selector-container">
                                            <select name="talkgroupIds" id="talkgroupIds">
                                                ${Object.keys(idDescriptionMap).map(talkgroupId => {
        let isSelected = selectedTalkgroupIds && selectedTalkgroupIds.includes(talkgroupId) ? 'selected' : '';
        return `<option value="${talkgroupId}" ${isSelected}>${idDescriptionMap[talkgroupId]}</option>`;
    }).join('')}
                                            </select>
                                        </div>
                                        <div class="filter_button_separator"></div>
                                        <center><button type="submit" class="filterButton">Filter</button></center>
                                    </div>
                                </div>
                            </div>
                            
                    </form>
                        <!-- Build list of transcriptions -->
                        <div class="separator"></div>
                        ${transcriptions.map(t => {
        let ridMatch = t.transcription.match(/"(\d+)(?: \([^)]+\))?"/);  // Regular expression to find a sequence of digits, optionally followed by a description in parentheses
        let rid = ridMatch ? ridMatch[1] : 'Unknown';  // If a match is found, use it; otherwise, set to 'Unknown'
        let fileName = path.basename(t.audio, '.mp3');
        let dateMatch = fileName.match(/\d{4}\d{2}\d{2}_\d{2}\d{2}\d{2}/);
        let idDescription = idDescriptionMap[t.id] ? ` (${idDescriptionMap[t.id]})` : '';  // Get the description if available
        let ridDescription = radio_id_names[rid] ? ` (${radio_id_names[rid]})` : '';  // Get the description if available

        let dateDisplay = dateMatch
            ? `${dateMatch[0].slice(0, 4)}-${dateMatch[0].slice(4, 6)}-${dateMatch[0].slice(6, 8)} ${dateMatch[0].slice(9, 11)}:${dateMatch[0].slice(11, 13)}:${dateMatch[0].slice(13, 15)} (TGID: <a href="javascript:void(0);" onclick="updateTGIDFilterAndRefresh('${t.id}')">${t.id}${idDescription}</a>, RID: <a href="javascript:void(0);" onclick="updateRIDFilterAndRefresh('${rid}')">${rid}${ridDescription}</a>)`  // Append the description
            : `Unknown Date (TGID: <a href="javascript:void(0);" onclick="updateTGIDFilterAndRefresh('${t.id}')">${t.id}${idDescription}</a>, RID: <a href="javascript:void(0);" onclick="updateRIDFilterAndRefresh('${rid}')">${rid}${ridDescription}</a>)`;  // Append the description
        return `
                                <h3>${dateDisplay}</h3>
                                <p>${t.transcription}</p>
                                <div class="audio-player">
                                    <audio id="audio">
                                        <source src="${t.audio}" type="audio/mp3">
                                    </audio>
                                    <button onclick="playPauseAudio(this)" class="playPauseBtn">Play</button>
                                </div>
                                <div class="separator"></div>
                            `;
    }).join('')}
                    </div>
                </div>
            <!-- Javaskriptz -->
            <script>
                var coll = document.getElementsByClassName("collapsible");
                for (var i = 0; i < coll.length; i++) {
                    coll[i].addEventListener("click", function() {
                        var content = this.nextElementSibling;
                        if (content.classList.contains("collapsed")) {
                            content.classList.remove("collapsed");
                        } else {
                            content.classList.add("collapsed");
                        } 
                    });
                }
                document.getElementById('autoRefreshCheckbox').addEventListener('change', function() {
                    if (this.checked) {
                        var interval = document.getElementById('refreshInterval').value;
                        window.autoRefreshTimeout = setTimeout(function() {
                            location.reload(true);
                        }, interval * 60 * 1000); // Convert minutes to milliseconds
                    } else {
                        clearTimeout(window.autoRefreshTimeout);
                    }
                });
                
                document.getElementById('refreshInterval').addEventListener('input', function() {
                    if (document.getElementById('autoRefreshCheckbox').checked) {
                        clearTimeout(window.autoRefreshTimeout); // Clear the existing timeout
                        var interval = this.value; 
                        window.autoRefreshTimeout = setTimeout(function() {
                            location.reload(true);
                        }, interval * 60 * 1000); // Restart with new interval
                    }
                });
                // Set initial values based on URL parameters
                var autoRefreshEnabled = new URLSearchParams(window.location.search).get('autoRefresh') === 'true';
                var refreshRateValue = new URLSearchParams(window.location.search).get('refreshRate') || '5';

                document.getElementById('autoRefreshCheckbox').checked = autoRefreshEnabled;
                document.getElementById('refreshInterval').value = refreshRateValue;

                // If auto-refresh is enabled, start the timer
                if (autoRefreshEnabled) {
                    setTimeout(function() {
                        location.reload(true);
                    }, refreshRateValue * 60 * 1000);
                }
                document.addEventListener('DOMContentLoaded', function() {
                    // Fetch all audio elements and buttons
                    let audios = document.querySelectorAll('audio');
                    let buttons = document.querySelectorAll('.playPauseBtn');
                
                    buttons.forEach((button, index) => {
                        let audio = audios[index];
                        
                        button.addEventListener('click', function() {
                            playPauseAudio(audio, button);
                        });
                        
                        audio.addEventListener('ended', function() {
                            button.innerText = 'Play';
                        });
                    });
                });
                
                function playPauseAudio(button) {
                    let audio = button.previousElementSibling;
                    if (audio.paused) {
                        audio.play();
                        button.innerText = 'Pause';
                    } else {
                        audio.pause();
                        button.innerText = 'Play';
                    }
                }
                document.getElementById("specialTextToggle").addEventListener("change", function() {
                    var h3Elements = document.querySelectorAll("h3"); // Select ALL h3 elements
                
                    h3Elements.forEach(h3 => {
                        if (this.checked) {
                            h3.classList.add("dateDisplay-text");  // Add the class
                        } else {
                            h3.classList.remove("dateDisplay-text");  // Remove the class
                        }
                    });
                });
                function updateTGIDFilterAndRefresh(tgid) {
                    let url = new URL(window.location.href);
                    let params = new URLSearchParams(url.search);
                    params.set('talkgroupIds', tgid);
                    url.search = params.toString();
                    window.location.href = url.toString();
                }
                function updateRIDFilterAndRefresh(rid) {
                    let url = new URL(window.location.href);
                    let params = new URLSearchParams(url.search);
                    params.set('radioIds', rid);
                    url.search = params.toString();
                    window.location.href = url.toString();
                }
            </script>
        </body>
        </html>
    `;
}


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

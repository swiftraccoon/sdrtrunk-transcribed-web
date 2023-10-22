const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone');
const path = require('path');
const app = express();
const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const basicAuth = require('express-basic-auth');
const cookieParser = require('cookie-parser');
app.use(cookieParser());


// Define your user(s) and password(s)
const users = {
    'read828': '828read',
};


app.use(basicAuth({
    users: users,
    challenge: true,  // Will display a pop-up asking for username/password
    realm: 'TOP SECRET (NEBULA PINNACLE) https://nebpin.cia.gov/',
    unauthorizedResponse: 'TOP SECRET (NEBULA PINNACLE) https://nebpin.cia.gov/ - 401 Unauthorized: Access is Restricted. Your details have been logged and forwarded.'
}));


const idDescriptionMap = {
    '41001': 'EMS',
    '41002': 'Fire Dept',
    '41003': 'Sheriff Dept',
    '41013': 'RPD',
    '41020': 'FCPD',
    '51533': 'MedCenter Air Helo Dispatch',
    '51583': 'Mission RTS',
    '51981': 'GOLF 3 - SW Interop',
    '52198': 'NCSHP/TroopG/Dist2',
    '52199': 'NCSHP/TroopG/Dist3',
    '52201': 'NCSHP/TroopG/Dist5',
    '52540': 'RthfdHos VMF5/VMN',
    '': 'No Filter',
};

const radio_id_names = {
    "1610092": "FCPD Dispatch",
    "1610051": "Sheriff Dispatch",
    "1610077": "EMS Dispatch",
    "2499936": "NCSHP Dispatch 36",
    "1610078": "RPD Dispatch",
    "1610018": "EMS CAD",
    "2499937": "NCSHP Dispatch 37",
    "1610019": "FD CAD",
    "": "No Filter",
};


app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});


app.use('/public', express.static(PUBLIC_DIR));


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


app.get('/', (req, res, next) => {
    let selectedRadioIds = req.query.radioIds ? [req.query.radioIds] : [''];
    let selectedTalkgroupIds = req.query.talkgroupIds ? [req.query.talkgroupIds] : [''];

    let userSelectedTheme;  // Declare the variable first

    // If the user has selected a theme, update the cookie
    if (req.query.theme) {
        res.cookie('theme', req.query.theme);
        userSelectedTheme = req.query.theme;
    } else {
        userSelectedTheme = req.cookies.theme || 'gray'; // Default to 'gray' if no theme cookie
    }

    let now = moment().tz("America/New_York");
    let tomorrow = moment().add(1, 'days');
    let eightHoursAgo = now.clone().subtract(2, 'hours');

    let defaultEndDate = tomorrow.format('YYYY-MM-DD');
    let defaultEndTime = tomorrow.format('HH:mm');

    let defaultStartDate = eightHoursAgo.format('YYYY-MM-DD');
    let defaultStartTime = eightHoursAgo.format('HH:mm');

    // Capture the auto-refresh parameters from the request's query
    let autoRefreshEnabled = req.query.autoRefresh === 'true';
    let refreshRate = req.query.refreshRate ? parseInt(req.query.refreshRate, 10) : 5;  // Default to 5 minutes

    let startDate = req.query.startDate_date && req.query.startDate_time 
        ? new Date(`${req.query.startDate_date}T${req.query.startDate_time}Z`) 
        : new Date(`${defaultStartDate}T${defaultStartTime}Z`);

    let endDate = req.query.endDate_date && req.query.endDate_time 
        ? new Date(`${req.query.endDate_date}T${req.query.endDate_time}Z`) 
        : new Date(`${defaultEndDate}T${defaultEndTime}Z`);

    let dirs = fs.readdirSync(path.join(PUBLIC_DIR, 'audio'));
    let transcriptionsList = [];

    dirs.forEach(dir => {
        let audioFiles = fs.readdirSync(path.join(PUBLIC_DIR, 'audio', dir))
            .filter(file => {
                let radioIdMatch = file.match(/FROM_(\d+)\.mp3/);
                if (!radioIdMatch) return false;
                let radioId = radioIdMatch[1];
                return (selectedRadioIds.includes('') || selectedRadioIds.includes(radioId)) && (selectedTalkgroupIds.includes('') || selectedTalkgroupIds.includes(dir)) && file.endsWith('.mp3') && isWithinDateRange(file, startDate, endDate);
            })
            .sort((a, b) => extractDateFromFilename(b) - extractDateFromFilename(a));

        audioFiles.forEach(file => {
            let transcriptionPath = path.join(PUBLIC_DIR, 'transcriptions', dir, file.replace('.mp3', '.txt'));
            transcriptionsList.push({
                id: dir,
                audio: `/public/audio/${dir}/${file}`,
                transcription: fs.existsSync(transcriptionPath) ? fs.readFileSync(transcriptionPath, 'utf-8') : "Transcription not found",
                timestamp: extractDateFromFilename(file)
            });
        });
    });

    // Sort the entire list by timestamp
    transcriptionsList.sort((a, b) => b.timestamp - a.timestamp);

    res.set('Cache-Control', 'no-store');
    res.send(renderHTML(transcriptionsList, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime, selectedRadioIds, selectedTalkgroupIds, userSelectedTheme));
});

function renderHTML(transcriptions, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime, selectedRadioIds, selectedTalkgroupIds, theme){
    const themeCSSLink = {
        gray: "public/gray.css",
        darkGray: "public/darkGray.css",
        ultraDark: "public/ultraDark.css"
    }[theme] || "public/gray.css"; // Use gray theme as default if theme is undefined or not matching.    
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
        <center><h3><a href="https://www.broadcastify.com/calls/node/1">Node 1: Node</a><br /></h3>
        <div class="transcription">
            <button class="collapsible">Information</button>
            <div class="collapsed">
                <h4>Some text</h4>
            </div>
        </div>
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
                        List links to the talkgroup IDs on Broadcastify for easy following if you want.
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
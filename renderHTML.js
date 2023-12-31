// Module imports
const path = require('path');
const config = require('./config');

// Configuration settings from config
const WEB_nodeID = config.WEB_nodeID;
const WEB_nodeName = config.WEB_nodeName;
const idDescriptionMap = config.idDescriptionMap;
const radio_id_names = config.radio_id_names;
const broadcastifyLinks = config.broadcastifyLinks;


function renderHTML(transcriptions, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime, selectedRadioIds, selectedTalkgroupIds, theme) {
    const themeCSSLink = {
        gray: "public/gray.css",
        darkGray: "public/darkGray.css",
        ultraDark: "public/ultraDark.css",
        colorPsych: "public/colorPsych.css",
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
        <center><h3><a href="https://www.broadcastify.com/calls/node/${WEB_nodeID}">Node ${WEB_nodeID}: ${WEB_nodeName}</a><br /></h3>
        <div class="transcription">
            <button type="button" class="collapsible">Search | Subscription | Themes</button>
            <div class="collapsed"><br />
                <!-- Search Box -->
                <div class="search-box">
                <form action="/search" method="get">
                    <input type="text" name="q" placeholder="Search transcriptions...">
                    <button type="submit">Search</button>
                </form>
                </div><br />
                <form action="/subscribe" method="post" class="subscription-form">
                <div class="subscription-box">
                    <input type="text" id="regex" name="regex" placeholder="Enter regex">
                    <input type="text" id="email" name="email" placeholder="Enter email"><br />
                    <div class="subscription_button_separator"></div>
                    <button type="submit" class="subscription_button">Subscribe</button>
                    <button type="submit" formaction="/unsubscribe" class="subscription_button">Unsubscribe</button>
                </div>
                </form><br />
                <form action="/" method="get">
                <!-- Theme selector -->
                <div style="display: inline-block; vertical-align: top; border-right: 1px solid #444; padding-right: 1px; margin-right: 1px; padding-left: 1px; margin-left: 1px;">
                    <label for="themeSelector"></label>
                    <select name="theme">
                    <option value="gray" ${theme === 'gray' ? 'selected' : ''}>Gray</option>
                    <option value="darkGray" ${theme === 'darkGray' ? 'selected' : ''}>Dark Gray</option>
                    <option value="ultraDark" ${theme === 'ultraDark' ? 'selected' : ''}>Ultra Dark</option>
                    <option value="colorPsych" ${theme === 'colorPsych' ? 'selected' : ''}>colorPsych</option>
                    </select>
                </div>
                <!-- Special text -->
                <div style="display: inline-block; vertical-align: top; border-right: 1px solid #444; padding-right: 1px; margin-right: 1px; padding-left: 1px; margin-left: 1px;">
                    <input type="checkbox" id="specialTextToggle">
                </div>
                <!-- Auto-refresh -->
                                <div style="display: inline-block; vertical-align: top; ">
                                    <input type="checkbox" id="autoRefreshCheckbox" name="autoRefresh" value="true">
                                    <input type="number" id="refreshInterval" name="refreshRate" min="1" max="60" value="5" style="width: 15px;"> min
                                </div>
                                <button type="submit">Apply</button>
                </form>
            </div>
            </div>
                </form>
                </center>
            <!-- Broadcastify Links -->
            <div class="transcription">
                <button class="collapsible">Broadcastify Links</button>
                    <div class="collapsed">
                        ${broadcastifyLinks}
            </div>
                <div class="transcription">
                    <div class="content">
                        <form method="GET">
                            <!-- Date Selector -->
                            <div class="flex-container">
                                <div style="display: inline-block; vertical-align: top; border-right: 1px solid #444; padding-right: 1px; margin-right: 1px; padding-left: 1px; margin-left: 1px;">
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
                                        <div class="filter_button_separator"></div>
                                        <button type="button" class="filterButton" onclick="setDefaultDatesAndTimes()">Default Date/Time</button>
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
                                        <center>
                                            <button type="submit" class="filterButton">Apply Filters</button>
                                            <button type="button" class="filterButton" onclick="clearFiltersAndRefresh()">Reset ID Filters</button>
                                        </center>
                                    </div>
                                </div>
                            </div>
                            
                    </form>
                        <!-- Build list of transcriptions -->
                        <div class="separator"></div>
                        ${transcriptions.map(t => {
        let fileName = path.basename(t.audio, '.mp3');
        let ridMatch = fileName.match(/FROM_(\d+)/);  // regex to extract RID from file name
        let rid = ridMatch ? ridMatch[1] : 'Unknown';  // Use extracted RID or 'Unknown' if not found
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
                document.addEventListener("DOMContentLoaded", function() {
                    // Get URL parameters
                    const urlParams = new URLSearchParams(window.location.search);
                
                    // Check if filters are set, otherwise use default values
                    const startDate = urlParams.get('startDate_date') || '${defaultStartDate}';
                    const startTime = urlParams.get('startDate_time') || '${defaultStartTime}';
                    const endDate = urlParams.get('endDate_date') || '${defaultEndDate}';
                    const endTime = urlParams.get('endDate_time') || '${defaultEndTime}';
                
                    // Set the input fields
                    document.getElementsByName('startDate_date')[0].value = startDate;
                    document.getElementsByName('startDate_time')[0].value = startTime;
                    document.getElementsByName('endDate_date')[0].value = endDate;
                    document.getElementsByName('endDate_time')[0].value = endTime;
                });
                function setDefaultDatesAndTimes() {
                    document.getElementsByName('startDate_date')[0].value = '${defaultStartDate}';
                    document.getElementsByName('startDate_time')[0].value = '${defaultStartTime}';
                    document.getElementsByName('endDate_date')[0].value = '${defaultEndDate}';
                    document.getElementsByName('endDate_time')[0].value = '${defaultEndTime}';
                }
                function clearFiltersAndRefresh() {
                    let url = new URL(window.location.href);
                    let params = new URLSearchParams(url.search);
                    params.delete('talkgroupIds');
                    params.delete('radioIds');
                    url.search = params.toString();
                    window.location.href = url.toString();
                }
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
                function subscribe() {
                    console.log("Subscribe button clicked");
                    const regex = document.getElementById('regex').value;
                    const email = document.getElementById('email').value;

                    // AJAX call to subscribe
                    fetch('/subscribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ regex, email })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert('Subscription successful. Please check your email for confirmation.');
                        } else {
                            alert('Subscription failed. Please try again.');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('An error occurred. Please try again.');
                    });
                }
                function unsubscribe() {
                    console.log("Unsubscribe button clicked");
                    const email = document.getElementById('email').value;

                    // AJAX call to unsubscribe
                    fetch('/unsubscribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            alert('Successfully unsubscribed.');
                        } else {
                            alert('Unsubscription failed. Please try again.');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('An error occurred. Please try again.');
                    });
                }
            </script>
        </body>
        </html>
    `;
}

module.exports = renderHTML;
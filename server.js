const express = require('express');
const fs = require('fs');
const moment = require('moment-timezone');
const path = require('path');
const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 3000;


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
    let now = moment().tz("America/New_York");
    let eightHoursAgo = now.clone().subtract(2, 'hours');

    let defaultEndDate = now.format('YYYY-MM-DD');
    let defaultEndTime = now.format('HH:mm');

    let defaultStartDate = eightHoursAgo.format('YYYY-MM-DD');
    let defaultStartTime = eightHoursAgo.format('HH:mm');

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
            .filter(file => file.endsWith('.mp3') && isWithinDateRange(file, startDate, endDate))
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

    res.send(renderHTML(transcriptionsList, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime));
});

function renderHTML(transcriptions, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SDR Transcriptions</title>
            <style>
            body {
                background-color: #1e1e1e;
                color: #e1e1e1;
                font-family: 'Open Sans', sans-serif;
                line-height: 1.6;
            }
            
            .transcription, .eventbox {
                margin: 20px 0;
                padding: 20px;
                border: 1px solid #3a3a3a;
                border-radius: 5px;
                box-shadow: 2px 2px 12px rgba(0, 0, 0, 0.3);
                background-color: #2a2a2a;
            }
            
            .collapsible {
                cursor: pointer;
                border: none;
                outline: none;
                text-align: left;
                background-color: #007BFF;
                color: #fff;
                padding: 10px 15px;
                border-radius: 5px;
                transition: background-color 0.3s ease;
            }
            
            .collapsible:hover {
                background-color: #0056b3;
            }
            
            .collapsed {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.2s ease-out;
            }
            
            .audio-controls {
                margin-top: 10px;
            }
            
            h3 {
                margin-top: 0;
                color: #f1f1f1;
            }
            
            button {
                padding: 10px 15px;
                border: none;
                border-radius: 5px;
                background-color: #007BFF;
                color: #fff;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            
            button:hover {
                background-color: #0056b3;
            }
            
            .separator {
                height: 2px;
                background: linear-gradient(to right, transparent, #444, transparent);
                margin: 20px 0;
            }
            
            input[type="date"], input[type="time"] {
                padding: 10px;
                border: 1px solid #3a3a3a;
                border-radius: 5px;
                background-color: #2a2a2a;
                color: #e1e1e1;
            }
            
            input[type="date"]:focus, input[type="time"]:focus {
                border-color: #007BFF;
                outline: none;
                box-shadow: 0 0 5px #007BFF;
            }
            
            </style>
        </head>
        <body>
        <center><h3><a href="https://www.broadcastify.com/calls/node/1111">Node 1111: Node Name</a><br />
            DISCLAIMER: The audio is transcribed by AI. It could be completely incorrect.</h3></center>
            <div class="transcription">
                <button class="collapsible">TGIDs->Names</button>
                    <div class="content">
                        <a href="https://www.broadcastify.com/calls/tg/1111/11111">11111:Alias</a> <br />
                    </div>
            </div>
                <div class="transcription">
                    <div class="content">
                        <form method="GET">
                            Start: <input type="date" name="startDate_date" value="${defaultStartDate}">
                            <input type="time" name="startDate_time" value="${defaultStartTime}">
                            End: <input type="date" name="endDate_date" value="${defaultEndDate}">
                            <input type="time" name="endDate_time" value="${defaultEndTime}">
                            <button type="submit">Filter</button>
                        </form>
                        <div class="separator"></div>
                        ${transcriptions.map(t => {
                            let fileName = path.basename(t.audio, '.mp3');
                            let dateMatch = fileName.match(/\d{4}\d{2}\d{2}_\d{2}\d{2}\d{2}/);
                            let dateDisplay = dateMatch 
                                ? `${dateMatch[0].slice(0, 4)}-${dateMatch[0].slice(4, 6)}-${dateMatch[0].slice(6, 8)} ${dateMatch[0].slice(9, 11)}:${dateMatch[0].slice(11, 13)}:${dateMatch[0].slice(13, 15)} (TGID: ${t.id})`
                                : `Unknown Date (Folder: ${t.id})`;
                            return `
                                <h3>${dateDisplay}</h3>
                                <p>${t.transcription}</p>
                                <audio controls>
                                    <source src="${t.audio}" type="audio/mp3">
                                </audio>
                                <div class="separator"></div>
                            `;
                        }).join('')} 
                    </div>
                </div>
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
            </script>
        </body>
        </html>
    `;
}


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

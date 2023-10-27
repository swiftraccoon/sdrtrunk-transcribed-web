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

module.exports = {
    isWithinDateRange,
    extractDateFromFilename
};
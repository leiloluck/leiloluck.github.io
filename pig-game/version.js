// Single source of truth for app version — date-based, YY.MM.DD (matches Leilo Lucky).
// Bump to today's date on every deploy. Imported by index.html (<script src>)
// and service-worker.js (importScripts).
const APP_VERSION = '26.09.18';

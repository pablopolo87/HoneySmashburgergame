
const { exec } = require('child_process');

console.log('Installing dependencies...');
exec('npm install', (err, stdout, stderr) => {
    if (err) {
        console.error(`Error installing dependencies: ${err}`);
        return;
    }
    console.log(stdout);
    console.error(stderr);

    console.log('Starting server...');
    require('./server.js');
});

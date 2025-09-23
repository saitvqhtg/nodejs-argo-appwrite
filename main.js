const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// 环境变量
const UPLOAD_URL = process.env.UPLOAD_URL || '';
const PROJECT_URL = process.env.PROJECT_URL || '';
const AUTO_ACCESS = process.env.AUTO_ACCESS || false;
const FILE_PATH = process.env.FILE_PATH || './tmp';
const SUB_PATH = process.env.SUB_PATH || 'sub';
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const UUID = process.env.UUID || '9afd1229-b893-40c1-84dd-51e7ce204913';
const NEZHA_SERVER = process.env.NEZHA_SERVER || '';
const NEZHA_PORT = process.env.NEZHA_PORT || '';
const NEZHA_KEY = process.env.NEZHA_KEY || '';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || '';
const ARGO_AUTH = process.env.ARGO_AUTH || '';
const ARGO_PORT = process.env.ARGO_PORT || 8001;
const CFIP = process.env.CFIP || 'www.visa.com.sg';
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || 'Vls';

// 路径定义
const subPath = path.join(FILE_PATH, 'sub.txt');
const bootLogPath = path.join(FILE_PATH, 'boot.log');

// 根路由
app.get("/", function(req, res) {
    res.send("Hello world!");
});

async function runProcesses() {
    // 运行ne-zha
    if (NEZHA_SERVER && NEZHA_KEY) {
        if (!NEZHA_PORT) {
            const port = NEZHA_SERVER.includes(':') ? NEZHA_SERVER.split(':').pop() : '';
            const tlsPorts = new Set(['443', '8443', '2096', '2087', '2083', '2053']);
            const nezhatls = tlsPorts.has(port) ? 'true' : 'false';
            const configYaml = `
client_secret: ${NEZHA_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: false
ip_report_period: 1800
report_delay: 1
server: ${NEZHA_SERVER}
skip_connection_count: false
skip_procs_count: false
temperature: false
tls: ${nezhatls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}`;
            fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), configYaml);
            exec(`nohup ${path.join(FILE_PATH, 'php')} -c "${path.join(FILE_PATH, 'config.yaml')}" >/dev/null 2>&1 &`).catch(e => console.error(e));
            console.log('php is running');
        } else {
            const NEZHA_TLS = ['443', '8443', '2096', '2087', '2083', '2053'].includes(NEZHA_PORT) ? '--tls' : '';
            exec(`nohup ${path.join(FILE_PATH, 'npm')} -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${NEZHA_TLS} >/dev/null 2>&1 &`).catch(e => console.error(e));
            console.log('npm is running');
        }
    }

    // 运行xr-ay
    const config = {
        log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
        inbounds: [
            { port: ARGO_PORT, protocol: 'vless', settings: { clients: [{ id: UUID, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: 3001 }, { path: "/vless-argo", dest: 3002 }, { path: "/vmess-argo", dest: 3003 }, { path: "/trojan-argo", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
            { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
            { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
            { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: UUID, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
            { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: UUID }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
        ],
        dns: { servers: ["https+local://8.8.8.8/dns-query"] },
        outbounds: [ { protocol: "freedom", tag: "direct" }, {protocol: "blackhole", tag: "block"} ]
    };
    fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config, null, 2));
    exec(`nohup ${path.join(FILE_PATH, 'web')} -c ${path.join(FILE_PATH, 'config.json')} >/dev/null 2>&1 &`).catch(e => console.error(e));
    console.log('web is running');

    // 运行cloudflared
    let args;
    if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
        args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH}`;
    } else if (ARGO_AUTH.match(/TunnelSecret/)) {
        args = `tunnel --edge-ip-version auto --config ${path.join(FILE_PATH, 'tunnel.yml')} run`;
    } else {
        args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${bootLogPath} --loglevel info --url http://localhost:${ARGO_PORT}`;
    }
    exec(`nohup ${path.join(FILE_PATH, 'bot')} ${args} >/dev/null 2>&1 &`).catch(e => console.error(e));
    console.log('bot is running');

    // 等待隧道启动
    await new Promise(resolve => setTimeout(resolve, 8000));
    await generateAndServeLinks();
}

async function generateAndServeLinks() {
    let argoDomain;
    if (ARGO_AUTH && ARGO_DOMAIN) {
        argoDomain = ARGO_DOMAIN;
    } else {
        for (let i = 0; i < 10; i++) {
            if (fs.existsSync(bootLogPath)) {
                const logContent = fs.readFileSync(bootLogPath, 'utf-8');
                const domainMatch = logContent.match(/https?:\/\/([^ ]*trycloudflare\.com)/);
                if (domainMatch) {
                    argoDomain = domainMatch[1];
                    break;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    if (!argoDomain) {
        console.error("Failed to get Argo domain.");
        return;
    }

    console.log('ARGO_DOMAIN:', argoDomain);

    // 获取 ISP 信息
    let ISP = 'Unknown-ISP';
    try {
        // 使用 axios 替代 curl 命令来获取 ISP 信息
        const response = await axios.get('https://speed.cloudflare.com/meta');
        const data = response.data;
        const country = data.country || 'Unknown';
        const asOrganization = data.asOrganization || 'Unknown';
        ISP = `${country}-${asOrganization}`.replace(/\s/g, '_');
    } catch (error) {
        console.error("Failed to get ISP info using axios:", error.message);
    }

    const VMESS = { v: '2', ps: `${NAME}-${ISP}`, add: CFIP, port: CFPORT, id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '' };
    const subTxt = `
    vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${NAME}-${ISP}
    
    vmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}
    
    trojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${NAME}-${ISP}
    `.trim();
    
    console.log(Buffer.from(subTxt).toString('base64'));
    fs.writeFileSync(subPath, Buffer.from(subTxt).toString('base64'));
    console.log(`${subPath} saved successfully`);

    // 设置订阅路由
    app.get(`/${SUB_PATH}`, (req, res) => {
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(Buffer.from(subTxt).toString('base64'));
    });
}

// 启动服务器
app.listen(PORT, async () => {
    console.log(`http server is running on port:${PORT}!`);
    await runProcesses();
});

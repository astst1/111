import http from 'http';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DeepSeek API配置
const DEEPSEEK_API_KEY = 'sk-1898470060b3465da9b6877c41e3dc65';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 创建HTTP服务器
const server = http.createServer(async (req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 路由处理
    if (req.method === 'GET' && req.url === '/') {
        // 提供主页
        try {
            const content = fs.readFileSync(path.join(__dirname, 'index.html'));
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        } catch (error) {
            res.writeHead(500);
            res.end('服务器错误');
        }
    } else if (req.method === 'POST' && req.url === '/api/chat') {
        // 处理聊天API请求
        try {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                const { message } = JSON.parse(body);

                // 准备发送到DeepSeek API的数据
                const apiRequestBody = {
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: '你是一位专业的Life Coach，擅长通过对话帮助人们发现自己的潜力，解决生活中的问题，实现个人成长。你会：\n1. 以同理心倾听用户的问题和困扰\n2. 提出有见地的问题，帮助用户深入思考\n3. 给出具体、可行的建议和行动计划\n4. 保持积极、支持的态度，激发用户的动力\n5. 注重长期发展，帮助用户建立持续成长的能力'
                        },
                        { role: 'user', content: message }
                    ],
                    stream: true,
                    temperature: 0.7,
                    max_tokens: 2000,
                    top_p: 0.9
                };

                // 设置超时的fetch请求
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 60000);

                try {
                    const apiResponse = await fetch(DEEPSEEK_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                        },
                        body: JSON.stringify(apiRequestBody),
                        signal: controller.signal
                    });

                    if (!apiResponse.ok) {
                        throw new Error(`API请求失败: ${apiResponse.status}`);
                    }

                    // 设置响应头以支持流式输出
                    res.writeHead(200, {
                        'Content-Type': 'text/plain',
                        'Transfer-Encoding': 'chunked'
                    });

                    // 直接使用response.body作为可读流
                    apiResponse.body.pipe(res);

                    // 监听完成和错误事件
                    apiResponse.body.on('end', () => {
                        res.end();
                    });

                    apiResponse.body.on('error', (error) => {
                        console.error('Stream error:', error);
                        if (!res.headersSent) {
                            res.writeHead(500);
                        }
                        res.end('读取响应流时发生错误');
                    });
                } catch (error) {
                    console.error('API请求错误:', error);
                    if (!res.headersSent) {
                        res.writeHead(500);
                    }
                    res.end('API请求失败: ' + error.message);
                } finally {
                    clearTimeout(timeout);
                }
            });
        } catch (error) {
            console.error('请求处理错误:', error);
            res.writeHead(400);
            res.end('无效的请求');
        }
    } else if (req.method === 'GET') {
        // 处理静态资源
        try {
            const filePath = path.join(__dirname, req.url);
            const extname = path.extname(filePath);
            const contentType = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml'
            }[extname] || 'text/plain';

            const content = fs.readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } catch (error) {
            res.writeHead(404);
            res.end('未找到');
        }
    } else {
        res.writeHead(404);
        res.end('未找到');
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
// backend/server.js - 完全修复版（适合新手）
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ObjectId } = require('mongodb');

console.log('='.repeat(60));
console.log('🚀 正在启动服务器...');
console.log('='.repeat(60));

// 设置环境变量
if (!process.env.MONGODB_URI) {
    console.log('🔧 使用本地连接字符串');
    process.env.MONGODB_URI = "mongodb+srv://franrisk:djy050405@my-online-notebook.vbrb6e1.mongodb.net/notes_app?retryWrites=true&w=majority&appName=my-online-notebook";
}

console.log('📊 环境检查:');
console.log('- 端口:', process.env.PORT || 5000);
console.log('- 数据库:', process.env.MONGODB_URI ? '✅ 已配置' : '❌ 未配置');
console.log('='.repeat(60));

const { connect, getCollection, healthCheck } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());  // 允许跨域
app.use(express.json());  // 解析JSON数据
app.use(express.urlencoded({ extended: true }));  // 解析表单数据

// 全局变量
let isDbConnected = false;

// ==================== 1. 连接数据库 ====================
async function connectToDatabase() {
    try {
        console.log('🔌 正在连接数据库...');
        await connect();
        isDbConnected = true;
        console.log('✅ 数据库连接成功！');
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        isDbConnected = false;
        console.log('⚠️  应用将在无数据库模式下运行');
    }
}

// ==================== 2. API路由 ====================

// 首页
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>我的在线记事本</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #333; }
                .box { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 10px 0; }
                a { color: #3498db; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>📝 我的在线记事本</h1>
            <div class="box">
                <h3>服务器状态: <span style="color:green">✅ 运行中</span></h3>
                <p>数据库: ${isDbConnected ? '✅ 已连接' : '❌ 未连接'}</p>
                <p>端口: ${PORT}</p>
            </div>
            <div class="box">
                <h3>🔗 快速链接:</h3>
                <ul>
                    <li><a href="/app" target="_blank">📱 打开前端应用</a></li>
                    <li><a href="/health" target="_blank">❤️‍🩹 健康检查</a></li>
                    <li><a href="/api/notes" target="_blank">📄 获取所有笔记</a></li>
                </ul>
            </div>
        </body>
        </html>
    `);
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '服务器运行正常',
        database: isDbConnected ? 'connected' : 'disconnected',
        time: new Date().toISOString()
    });
});

// 获取所有笔记
app.get('/api/notes', async (req, res) => {
    console.log('📥 收到获取笔记请求');

    try {
        if (!isDbConnected) {
            return res.json([]);
        }

        const collection = getCollection();
        const notes = await collection.find({}).sort({ createdAt: -1 }).toArray();

        console.log(`✅ 返回 ${notes.length} 条笔记`);
        res.json(notes);

    } catch (error) {
        console.error('❌ 获取笔记失败:', error.message);
        res.status(500).json({ error: '获取笔记失败' });
    }
});

// 创建新笔记
app.post('/api/notes', async (req, res) => {
    console.log('📥 收到创建笔记请求:', req.body);

    try {
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: '笔记内容不能为空' });
        }

        if (!isDbConnected) {
            return res.status(503).json({ error: '数据库未连接' });
        }

        const collection = getCollection();
        const newNote = {
            content: content.trim(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await collection.insertOne(newNote);
        const savedNote = {
            ...newNote,
            _id: result.insertedId
        };

        console.log(`✅ 笔记保存成功，ID: ${result.insertedId}`);
        res.status(201).json(savedNote);

    } catch (error) {
        console.error('❌ 保存笔记失败:', error.message);
        res.status(500).json({ error: '保存笔记失败' });
    }
});

// 删除笔记
app.delete('/api/notes/:id', async (req, res) => {
    console.log('📥 收到删除笔记请求，ID:', req.params.id);

    try {
        if (!isDbConnected) {
            return res.status(503).json({ error: '数据库未连接' });
        }

        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: '无效的笔记ID' });
        }

        const collection = getCollection();
        const result = await collection.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: '笔记不存在' });
        }

        console.log(`✅ 笔记删除成功，ID: ${req.params.id}`);
        res.json({ success: true, message: '笔记已删除' });

    } catch (error) {
        console.error('❌ 删除笔记失败:', error.message);
        res.status(500).json({ error: '删除笔记失败' });
    }
});

// ==================== 3. 前端文件服务 ====================

// 提供前端HTML文件
app.get('/app', (req, res) => {
    console.log('📄 提供前端页面');
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 提供CSS文件
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/style.css'));
});

// 提供JS文件
app.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/app.js'));
});

// ==================== 4. 错误处理 ====================

// 404页面
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>404 - 页面不存在</title></head>
        <body>
            <h1>❌ 404 - 页面不存在</h1>
            <p>你访问的页面 <strong>${req.url}</strong> 不存在</p>
            <p><a href="/">返回首页</a></p>
        </body>
        </html>
    `);
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('🔥 服务器错误:', err);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>500 - 服务器错误</title></head>
        <body>
            <h1>🔥 500 - 服务器内部错误</h1>
            <p>${err.message}</p>
            <p><a href="/">返回首页</a></p>
        </body>
        </html>
    `);
});

// ==================== 5. 启动服务器 ====================

async function startServer() {
    console.log('🔄 正在连接数据库...');
    await connectToDatabase();

    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🎉 服务器启动成功！');
        console.log('='.repeat(60));
        console.log(`📡 本地访问: http://localhost:${PORT}`);
        console.log(`🌐 前端应用: http://localhost:${PORT}/app`);
        console.log(`📊 数据库状态: ${isDbConnected ? '✅ 已连接' : '❌ 未连接'}`);
        console.log('='.repeat(60));
        console.log('🔗 测试链接:');
        console.log(`  1. 首页: http://localhost:${PORT}/`);
        console.log(`  2. 前端应用: http://localhost:${PORT}/app`);
        console.log(`  3. 健康检查: http://localhost:${PORT}/health`);
        console.log(`  4. 获取笔记: http://localhost:${PORT}/api/notes`);
        console.log('='.repeat(60));
    });
}

// 启动服务器
startServer();

// Vercel需要这个
module.exports = app;

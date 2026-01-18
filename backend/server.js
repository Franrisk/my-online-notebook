// server.js - 完整修复版本
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Windows SSL修复
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 导入数据库模块
const { connect, getCollection, healthCheck } = require('./db');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 5000;

// 使用中间件
app.use(cors());
app.use(express.json());

// 连接数据库
let isDbConnected = false;

async function initializeDatabase() {
    try {
        await connect();
        isDbConnected = true;
        console.log('✅ 数据库初始化完成');
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error.message);
        console.log('⚠️  应用将以内存模式运行（数据重启后丢失）');
        isDbConnected = false;
    }
}

// 启动时连接数据库
initializeDatabase();

// ==================== API 路由 ====================

// 1. 提供前端静态文件（重要！）
app.use(express.static(path.join(__dirname, '../frontend')));

// 2. API路由
app.get('/api/notes', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] 📥 GET /api/notes`);

    try {
        if (!isDbConnected) {
            throw new Error('数据库未连接');
        }

        const collection = getCollection();

        const notes = await collection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        console.log(`✅ 从数据库获取 ${notes.length} 条笔记`);
        res.json(notes);

    } catch (error) {
        console.error('❌ 获取笔记失败:', error.message);
        res.status(500).json({
            error: '获取笔记失败',
            mode: '请检查数据库连接'
        });
    }
});

app.post('/api/notes', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] 📥 POST /api/notes`, req.body);

    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({
            error: '笔记内容不能为空'
        });
    }

    try {
        if (!isDbConnected) {
            throw new Error('数据库未连接');
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

        console.log(`✅ 笔记保存成功 (ID: ${result.insertedId})`);

        res.status(201).json(savedNote);

    } catch (error) {
        console.error('❌ 保存笔记失败:', error.message);
        res.status(500).json({
            error: '保存笔记失败'
        });
    }
});

// 3. 健康检查
app.get('/health', async (req, res) => {
    const dbStatus = await healthCheck();
    res.json({
        status: 'healthy',
        database: dbStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// 4. 所有其他请求都返回前端
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ==================== 启动服务器 ====================
const server = app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 服务器启动成功！');
    console.log('='.repeat(60));
    console.log(`📡 地址: http://localhost:${PORT}`);
    console.log(`🔌 数据库: ${isDbConnected ? '✅ MongoDB Atlas' : '⚠️ 内存模式'}`);
    console.log('='.repeat(60));
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n🔻 正在关闭服务器...');
    const { close } = require('./db');
    await close();
    server.close(() => {
        console.log('👋 服务器已关闭');
        process.exit(0);
    });
});

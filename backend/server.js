// server.js - 最简化版本
const express = require('express');
const cors = require('cors');
const { ObjectId } = require('mongodb');

// 导入数据库
const { connect, getCollection, healthCheck } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());

// 连接数据库
let dbConnected = false;

(async () => {
    try {
        console.log('🔌 初始化数据库连接...');
        await connect();
        dbConnected = true;
        console.log('✅ 数据库初始化完成');
    } catch (error) {
        console.error('❌ 数据库连接失败');
        dbConnected = false;
    }
})();

// ========== API 路由 ==========

// 健康检查
app.get('/api/health', async (req, res) => {
    const dbStatus = await healthCheck();
    res.json({
        status: 'ok',
        database: dbStatus ? 'connected' : 'disconnected',
        time: new Date().toISOString()
    });
});

// 获取所有笔记
app.get('/api/notes', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.status(503).json({ 
                error: '数据库未连接',
                notes: [] 
            });
        }
        
        const collection = getCollection();
        const notes = await collection.find({})
            .sort({ createdAt: -1 })
            .toArray();
        
        res.json(notes);
    } catch (error) {
        console.error('获取笔记失败:', error);
        res.status(500).json({ 
            error: '获取笔记失败',
            notes: []
        });
    }
});

// 创建笔记
app.post('/api/notes', async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: '内容不能为空' });
        }
        
        if (!dbConnected) {
            return res.status(503).json({ error: '数据库未连接' });
        }
        
        const collection = getCollection();
        const newNote = {
            content: content.trim(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await collection.insertOne(newNote);
        const savedNote = { ...newNote, _id: result.insertedId };
        
        res.status(201).json(savedNote);
    } catch (error) {
        console.error('创建笔记失败:', error);
        res.status(500).json({ error: '创建笔记失败' });
    }
});

// 删除笔记
app.delete('/api/notes/:id', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.status(503).json({ error: '数据库未连接' });
        }
        
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: '无效的ID格式' });
        }
        
        const collection = getCollection();
        const result = await collection.deleteOne({
            _id: new ObjectId(req.params.id)
        });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: '笔记不存在' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('删除笔记失败:', error);
        res.status(500).json({ error: '删除笔记失败' });
    }
});

// 根路径返回简单信息
app.get('/', (req, res) => {
    res.json({
        message: '在线记事本API',
        status: 'running',
        endpoints: [
            'GET  /api/health',
            'GET  /api/notes',
            'POST /api/notes',
            'DELETE /api/notes/:id'
        ]
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
});

// 导出给Vercel
module.exports = app;

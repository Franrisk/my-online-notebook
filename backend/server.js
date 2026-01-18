// backend/server.js - Vercel + 本地双环境版本
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ObjectId } = require('mongodb');

// ========== 环境配置 ==========
console.log('='.repeat(60));
console.log('🚀 启动配置检查');
console.log('='.repeat(60));

// 判断环境
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const isLocal = !isVercel;

console.log('🌍 运行环境:');
console.log(`  - Vercel环境: ${isVercel ? '✅ 是' : '❌ 否'}`);
console.log(`  - 本地环境: ${isLocal ? '✅ 是' : '❌ 否'}`);
console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

// 本地开发时使用硬编码的连接字符串
if (isLocal && !process.env.MONGODB_URI) {
    console.log('🔧 本地环境：使用硬编码MONGODB_URI');
    process.env.MONGODB_URI = "mongodb+srv://franrisk:djy050405@my-online-notebook.vbrb6e1.mongodb.net/notes_app?retryWrites=true&w=majority&appName=my-online-notebook";
}

console.log(`🔑 MONGODB_URI: ${process.env.MONGODB_URI ? '✅ 已设置' : '❌ 未设置'}`);
if (process.env.MONGODB_URI) {
    // 安全显示连接字符串（隐藏密码）
    const safeUri = process.env.MONGODB_URI.replace(/:[^:]*@/, ':****@');
    console.log(`  连接字符串: ${safeUri.substring(0, 80)}...`);
}
console.log('='.repeat(60));

const { connect, getCollection, healthCheck } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 全局变量
let isDbConnected = false;

// ==================== 数据库初始化 ====================
async function initializeDatabase() {
    console.log('🔌 初始化数据库连接...');

    try {
        await connect();
        isDbConnected = true;
        console.log('✅ 数据库连接成功！');
        return true;
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        console.log('⚠️  应用将在无数据库模式下运行（部分功能受限）');
        isDbConnected = false;
        return false;
    }
}

// ==================== API 路由 ====================

// 首页（API信息）
app.get('/', (req, res) => {
    res.json({
        service: 'My Online Notebook API',
        version: '2.0.0',
        status: 'running',
        environment: isVercel ? 'vercel' : 'local',
        database: isDbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            notes: '/api/notes',
            environment: '/api/environment',
            frontend: isVercel ? '/' : '/app'  // Vercel上前端是根路径
        }
    });
});

// 环境信息
app.get('/api/environment', (req, res) => {
    res.json({
        platform: isVercel ? 'vercel' : 'local',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        database: {
            connected: isDbConnected,
            uriConfigured: !!process.env.MONGODB_URI
        },
        vercel: {
            isVercel: isVercel,
            region: process.env.VERCEL_REGION || 'not-vercel'
        }
    });
});

// 健康检查
app.get('/health', async (req, res) => {
    try {
        const dbStatus = isDbConnected ? await healthCheck() : false;

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            server: 'online',
            database: dbStatus ? 'connected' : 'disconnected',
            environment: isVercel ? 'production' : 'development',
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// 获取所有笔记
app.get('/api/notes', async (req, res) => {
    console.log(`📥 GET /api/notes`);

    try {
        if (!isDbConnected) {
            // 数据库未连接时返回空数组，而不是错误
            return res.json([]);
        }

        const collection = getCollection();
        const notes = await collection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        console.log(`✅ 返回 ${notes.length} 条笔记`);
        res.json(notes);

    } catch (error) {
        console.error('获取笔记失败:', error.message);
        res.status(500).json({
            error: 'Failed to fetch notes',
            message: error.message
        });
    }
});

// 创建新笔记
app.post('/api/notes', async (req, res) => {
    console.log(`📥 POST /api/notes`, req.body);

    try {
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({
                error: 'Content cannot be empty'
            });
        }

        if (!isDbConnected) {
            return res.status(503).json({
                error: 'Database not available',
                message: 'Cannot save note at the moment'
            });
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
        console.error('保存笔记失败:', error.message);
        res.status(500).json({
            error: 'Failed to save note',
            message: error.message
        });
    }
});

// 删除笔记
app.delete('/api/notes/:id', async (req, res) => {
    console.log(`📥 DELETE /api/notes/${req.params.id}`);

    try {
        if (!isDbConnected) {
            return res.status(503).json({
                error: 'Database not available'
            });
        }

        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                error: 'Invalid note ID format'
            });
        }

        const collection = getCollection();
        const result = await collection.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                error: 'Note not found'
            });
        }

        console.log(`✅ 笔记删除成功，ID: ${req.params.id}`);
        res.json({
            success: true,
            message: 'Note deleted successfully'
        });

    } catch (error) {
        console.error('删除笔记失败:', error.message);
        res.status(500).json({
            error: 'Failed to delete note',
            message: error.message
        });
    }
});

// ==================== 前端服务 ====================

// Vercel部署时，前端文件在根目录
if (isVercel) {
    // Vercel会自动处理静态文件，我们只需要提供API
    console.log('🌐 Vercel模式：前端由Vercel自动服务');
} else {
    // 本地开发时，提供前端文件
    console.log('💻 本地模式：提供前端静态文件');
    app.use(express.static(path.join(__dirname, '../frontend')));

    // 前端页面路由
    app.get('/app', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });

    app.get('/app/*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
}

// ==================== 错误处理 ====================

// 404处理
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err);

    res.status(500).json({
        error: 'Internal server error',
        message: isVercel ? 'Please contact administrator' : err.message,
        timestamp: new Date().toISOString()
    });
});

// ==================== 启动服务器 ====================

async function startServer() {
    console.log('🚀 启动服务器进程...');

    // 初始化数据库
    const dbInitialized = await initializeDatabase();

    if (isLocal) {
        // 本地开发：监听端口
        app.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log('🎉 本地服务器启动成功！');
            console.log('='.repeat(60));
            console.log(`📡 本地地址: http://localhost:${PORT}`);
            console.log(`🌐 前端页面: http://localhost:${PORT}/app`);
            console.log(`🔧 API地址: http://localhost:${PORT}/api/notes`);
            console.log(`📊 数据库: ${dbInitialized ? '✅ 已连接' : '❌ 未连接'}`);
            console.log(`⚙️  环境: ${process.env.NODE_ENV || 'development'}`);
            console.log('='.repeat(60));
        });
    } else {
        // Vercel环境：只打印信息
        console.log('='.repeat(60));
        console.log('☁️  Vercel部署环境');
        console.log('='.repeat(60));
        console.log(`📊 数据库: ${dbInitialized ? '✅ 已连接' : '❌ 未连接'}`);
        console.log(`⚙️  环境: ${process.env.NODE_ENV || 'production'}`);
        console.log(`🌐 区域: ${process.env.VERCEL_REGION || 'unknown'}`);
        console.log('='.repeat(60));
    }
}

// 启动服务器
startServer();

// Vercel需要这个导出
module.exports = app;

// server.js - Vercel部署版本
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ObjectId } = require('mongodb');

// 导入数据库模块
const { connect, getCollection, healthCheck } = require('./db');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 5000;

// 使用中间件
app.use(cors());
app.use(express.json());

// Vercel特定配置
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';

// 连接数据库
let isDbConnected = false;
let retryCount = 0;
const MAX_RETRIES = 3;

async function initializeDatabase() {
    try {
        console.log('🔌 初始化数据库连接...');
        console.log('运行环境:', process.env.NODE_ENV || 'development');
        console.log('是否Vercel环境:', isVercel ? '是' : '否');
        
        await connect();
        isDbConnected = true;
        console.log('✅ 数据库初始化完成');
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error.message);
        
        // Vercel环境下自动重试
        if (isVercel && retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`🔄 Vercel环境下重试连接 (${retryCount}/${MAX_RETRIES})...`);
            setTimeout(initializeDatabase, 2000 * retryCount); // 2秒、4秒、6秒后重试
        } else {
            console.log('⚠️  应用将以只读模式运行（无法保存数据）');
            isDbConnected = false;
        }
    }
}

// 启动时连接数据库
initializeDatabase();

// ==================== API 路由 ====================

// 健康检查（Vercel需要）
app.get('/api/health', async (req, res) => {
    const dbStatus = await healthCheck();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        platform: isVercel ? 'vercel' : 'local',
        database: {
            connected: dbStatus,
            retryCount: retryCount
        }
    });
});

// 获取所有笔记
app.get('/api/notes', async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/notes`);

    try {
        if (!isDbConnected) {
            return res.status(503).json({
                error: '数据库暂时不可用',
                notes: [] // 返回空数组而不是错误
            });
        }

        const collection = getCollection();
        const notes = await collection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        console.log(`✅ 获取 ${notes.length} 条笔记`);
        res.json(notes);

    } catch (error) {
        console.error('❌ 获取笔记失败:', error.message);
        // 出错时返回空数组而不是错误
        res.json([]);
    }
});

// 创建新笔记
app.post('/api/notes', async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/notes`);

    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({
            error: '笔记内容不能为空'
        });
    }

    try {
        if (!isDbConnected) {
            return res.status(503).json({
                error: '数据库暂时不可用，请稍后重试'
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

        console.log(`✅ 笔记保存成功 (ID: ${result.insertedId})`);
        res.status(201).json(savedNote);

    } catch (error) {
        console.error('❌ 保存笔记失败:', error.message);
        res.status(500).json({
            error: '保存笔记失败，请稍后重试'
        });
    }
});

// 删除笔记
app.delete('/api/notes/:id', async (req, res) => {
    console.log(`[${new Date().toISOString()}] DELETE /api/notes/${req.params.id}`);

    try {
        if (!isDbConnected) {
            return res.status(503).json({
                error: '数据库暂时不可用'
            });
        }

        const collection = getCollection();
        
        // 验证ID格式
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                error: '无效的笔记ID格式'
            });
        }

        const result = await collection.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                error: '笔记未找到'
            });
        }

        console.log(`✅ 笔记删除成功 (ID: ${req.params.id})`);
        res.json({ 
            success: true,
            message: '笔记删除成功'
        });

    } catch (error) {
        console.error('❌ 删除笔记失败:', error.message);
        res.status(500).json({
            error: '删除笔记失败'
        });
    }
});

// 数据库测试端点
app.get('/api/test', async (req, res) => {
    try {
        const dbStatus = await healthCheck();
        const collection = isDbConnected ? getCollection() : null;
        const count = isDbConnected ? await collection.countDocuments() : 0;
        
        res.json({
            success: true,
            message: 'API运行正常',
            environment: {
                node: process.version,
                platform: isVercel ? 'vercel' : 'local',
                env: process.env.NODE_ENV || 'development'
            },
            database: {
                connected: dbStatus,
                initialized: isDbConnected,
                noteCount: count,
                uriConfigured: !!process.env.MONGODB_URI
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Vercel需要这个端点用于健康检查
app.get('/api', (req, res) => {
    res.json({
        service: 'My Online Notebook API',
        version: '1.0.0',
        endpoints: [
            'GET    /api/health',
            'GET    /api/notes',
            'POST   /api/notes',
            'DELETE /api/notes/:id',
            'GET    /api/test'
        ]
    });
});

// 静态文件服务（Vercel部署时需要）
if (!isVercel) {
    // 本地开发时使用静态文件
    app.use(express.static(path.join(__dirname, '../frontend')));
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
}

// 处理404
app.use((req, res) => {
    res.status(404).json({
        error: '端点不存在',
        path: req.path,
        method: req.method
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('🔥 服务器错误:', err.message);
    console.error(err.stack);
    
    res.status(500).json({
        error: '服务器内部错误',
        message: isVercel ? '请联系管理员' : err.message
    });
});

// 启动服务器
if (!isVercel) {
    // 只在本地启动服务器
    const server = app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🚀 本地服务器启动成功！');
        console.log('='.repeat(60));
        console.log(`📡 地址: http://localhost:${PORT}`);
        console.log(`🔌 数据库: ${isDbConnected ? '✅ 已连接' : '❌ 未连接'}`);
        console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
        console.log('='.repeat(60));
        
        // 延迟检查数据库状态
        setTimeout(async () => {
            const status = await healthCheck();
            console.log(`📊 数据库状态: ${status ? '✅ 健康' : '❌ 异常'}`);
        }, 1000);
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
}

// Vercel需要这个导出
module.exports = app;

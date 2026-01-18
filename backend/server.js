// server.js - 连接MongoDB的完整版本
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // 加载环境变量

// 导入数据库模块
const { connect, getCollection, healthCheck } = require('./db');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 5000;

// 🔧 添加这行代码来修复Windows SSL问题（在app.use(cors())之前）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';  // <-- 就加这一行


// 使用中间件
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON请求体

// 连接数据库（应用启动时）
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

// 1. 根路径 - 显示API信息
app.get('/', (req, res) => {
    res.json({
        message: '📝 欢迎使用在线记事本API',
        version: '1.0.0',
        database: isDbConnected ? '✅ MongoDB Atlas' : '⚠️ 内存模式',
        endpoints: [
            'GET    /api/notes     - 获取所有笔记',
            'POST   /api/notes     - 创建新笔记',
            'DELETE /api/notes/:id - 删除笔记',
            'GET    /health        - 健康检查'
        ],
        note: '使用 MongoDB Atlas 云数据库存储数据'
    });
});

// 2. 健康检查接口（包含数据库状态）
app.get('/health', async (req, res) => {
    const dbStatus = await healthCheck();

    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// 3. 获取所有笔记（从MongoDB）
app.get('/api/notes', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] 📥 GET /api/notes`);

    try {
        if (!isDbConnected) {
            throw new Error('数据库未连接');
        }

        const collection = getCollection();

        // 从数据库获取所有笔记，按时间倒序排列
        const notes = await collection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        console.log(`✅ 从数据库获取 ${notes.length} 条笔记`);
        res.json(notes);

    } catch (error) {
        console.error('❌ 获取笔记失败:', error.message);
        res.status(500).json({
            success: false,
            error: '获取笔记失败',
            message: error.message,
            mode: '请检查数据库连接'
        });
    }
});

// 4. 创建新笔记（保存到MongoDB）
app.post('/api/notes', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] 📥 POST /api/notes`, req.body);

    const { content } = req.body;

    // 验证输入
    if (!content || content.trim() === '') {
        return res.status(400).json({
            success: false,
            error: '笔记内容不能为空',
            field: 'content'
        });
    }

    try {
        if (!isDbConnected) {
            throw new Error('数据库未连接');
        }

        const collection = getCollection();

        // 创建新笔记对象
        const newNote = {
            content: content.trim(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 插入到数据库
        const result = await collection.insertOne(newNote);

        // 添加MongoDB生成的_id到返回对象
        const savedNote = {
            ...newNote,
            _id: result.insertedId
        };

        console.log(`✅ 笔记保存成功 (ID: ${result.insertedId})`);

        res.status(201).json({
            success: true,
            message: '笔记创建成功',
            note: savedNote
        });

    } catch (error) {
        console.error('❌ 保存笔记失败:', error.message);
        res.status(500).json({
            success: false,
            error: '保存笔记失败',
            message: error.message,
            mode: '请检查数据库连接'
        });
    }
});

// 5. 删除笔记（从MongoDB删除）
app.delete('/api/notes/:id', async (req, res) => {
    const id = req.params.id;
    console.log(`[${new Date().toLocaleTimeString()}] 📥 DELETE /api/notes/${id}`);

    try {
        if (!isDbConnected) {
            throw new Error('数据库未连接');
        }

        const collection = getCollection();
        const { ObjectId } = require('mongodb');

        // 删除笔记
        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
            console.log(`✅ 笔记删除成功 (ID: ${id})`);
            res.json({
                success: true,
                message: '笔记删除成功',
                deletedId: id
            });
        } else {
            res.status(404).json({
                success: false,
                error: '笔记不存在',
                id: id
            });
        }

    } catch (error) {
        console.error('❌ 删除笔记失败:', error.message);

        // 如果是ID格式错误
        if (error.message.includes('ObjectId')) {
            return res.status(400).json({
                success: false,
                error: 'ID格式不正确',
                message: '请提供有效的笔记ID'
            });
        }

        res.status(500).json({
            success: false,
            error: '删除笔记失败',
            message: error.message
        });
    }
});

// ==================== 错误处理 ====================

// 404处理
app.use(/.*/, (req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在',
        requestedUrl: req.originalUrl,
        method: req.method,
        availableEndpoints: [
            'GET    /',
            'GET    /health',
            'GET    /api/notes',
            'POST   /api/notes',
            'DELETE /api/notes/:id'
        ]
    });
});

// 全局错误处理
app.use((err, req, res, next) => {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ 服务器错误:`, err);
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
    });
});

// ==================== 启动服务器 ====================
const server = app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 后端服务器启动成功！');
    console.log('='.repeat(60));
    console.log(`📡 本地地址: http://localhost:${PORT}`);
    console.log(`🔌 数据库: ${isDbConnected ? '✅ MongoDB Atlas' : '⚠️ 内存模式'}`);
    console.log('');
    console.log('📚 可用接口:');
    console.log(`  主页       GET    http://localhost:${PORT}/`);
    console.log(`  健康检查   GET    http://localhost:${PORT}/health`);
    console.log(`  获取笔记   GET    http://localhost:${PORT}/api/notes`);
    console.log(`  创建笔记   POST   http://localhost:${PORT}/api/notes`);
    console.log(`  删除笔记   DELETE http://localhost:${PORT}/api/notes/:id`);
    console.log('');
    console.log('🛡️  操作指南:');
    console.log('  • 使用 Ctrl+C 停止服务器');
    console.log(`  • 前端访问: http://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('✅ 等待请求中...');
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
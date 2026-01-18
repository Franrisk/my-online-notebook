// db.js - Vercel适配版本
const { MongoClient } = require('mongodb');

class Database {
    constructor() {
        this.client = null;
        this.db = null;
        this.collection = null;
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected) {
            return this.db;
        }

        try {
            const uri = process.env.MONGODB_URI;

            if (!uri) {
                console.error('❌ MONGODB_URI环境变量未设置');
                throw new Error('MONGODB_URI环境变量未设置');
            }

            console.log('🔄 尝试连接数据库...');
            
            // Vercel环境使用更安全的配置
            const clientOptions = {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
                maxPoolSize: 10,
                minPoolSize: 1,
                // 不再设置SSL选项，让MongoDB驱动自动处理
            };

            this.client = new MongoClient(uri, clientOptions);
            
            // 测试连接
            await this.client.connect();
            console.log('✅ MongoDB客户端连接成功');
            
            // 发送ping命令验证连接
            await this.client.db('admin').command({ ping: 1 });
            console.log('✅ MongoDB ping成功');

            // 选择数据库
            this.db = this.client.db('notes_app');
            this.collection = this.db.collection('notes');

            // 创建索引
            await this.collection.createIndex({ createdAt: -1 });
            console.log('✅ 索引创建成功');

            this.isConnected = true;
            console.log('✅ 成功连接到MongoDB Atlas');

            return this.db;

        } catch (error) {
            console.error('❌ 数据库连接失败:', error.message);
            console.error('错误详情:', error);
            
            // 如果是连接字符串问题，给出提示
            if (error.message.includes('mongodb+srv')) {
                console.log('\n💡 连接字符串问题提示:');
                console.log('   1. 确保MongoDB Atlas集群已启动');
                console.log('   2. 确保IP白名单已正确设置（建议添加 0.0.0.0/0）');
                console.log('   3. 检查用户名密码是否正确');
            }
            
            throw error;
        }
    }

    getCollection() {
        if (!this.isConnected) {
            throw new Error('数据库未连接');
        }
        return this.collection;
    }

    async healthCheck() {
        try {
            if (!this.isConnected || !this.client) {
                return false;
            }
            // 简单的ping命令检查连接状态
            await this.client.db('admin').command({ ping: 1 });
            return true;
        } catch (error) {
            console.error('❌ 数据库健康检查失败:', error.message);
            return false;
        }
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.isConnected = false;
        }
    }
}

const database = new Database();

module.exports = {
    db: database,
    connect: () => database.connect(),
    getCollection: () => database.getCollection(),
    healthCheck: () => database.healthCheck(),
    close: () => database.close()
};

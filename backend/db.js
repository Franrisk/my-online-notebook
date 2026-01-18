// db.js - 简化的数据库连接
const { MongoClient } = require('mongodb');
require('dotenv').config();

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
                throw new Error('请先在.env文件中设置MONGODB_URI');
            }

            console.log('🔄 尝试连接数据库...');

            // 使用简化的连接配置
            this.client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000
            });

            await this.client.connect();

            // 选择数据库
            this.db = this.client.db('notes_app');
            this.collection = this.db.collection('notes');

            this.isConnected = true;
            console.log('✅ 成功连接到MongoDB Atlas');

            return this.db;

        } catch (error) {
            console.error('❌ 数据库连接失败:', error.message);

            if (error.message.includes('SSL')) {
                console.log('\n💡 Windows SSL问题解决方案:');
                console.log('   已经在server.js中添加了SSL修复代码');
                console.log('   如果还不行，可能是:');
                console.log('   1. 连接字符串格式错误');
                console.log('   2. IP地址未添加到白名单');
                console.log('   3. 密码错误');
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
    close: () => database.close()
};
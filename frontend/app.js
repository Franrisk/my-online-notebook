// frontend/app.js - 添加详细调试
document.addEventListener('DOMContentLoaded', function () {
    console.log('📝 Notebook Frontend Loading...');
    console.log('当前页面URL:', window.location.href);
    console.log('页面路径:', window.location.pathname);

    // 自动检测API地址
    const API_BASE = window.location.origin;
    console.log('🌐 检测到的API基础地址:', API_BASE);

    const noteInput = document.getElementById('noteInput');
    const saveBtn = document.getElementById('saveBtn');
    const notesList = document.getElementById('notesList');
    const emptyMessage = document.getElementById('emptyMessage');

    // 显示加载状态
    notesList.innerHTML = '<li style="color:#666;text-align:center;padding:20px;">正在加载笔记...</li>';

    // ========== 核心功能 ==========

    // 获取笔记
    async function fetchNotes() {
        console.log('🔍 正在从以下地址获取笔记:', `${API_BASE}/api/notes`);

        try {
            const response = await fetch(`${API_BASE}/api/notes`);
            console.log('响应状态:', response.status, response.statusText);
            console.log('响应头:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                console.error('请求失败:', response);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const notes = await response.json();
            console.log('📊 获取到的笔记数据:', notes);
            console.log('笔记数量:', notes.length);

            displayNotes(notes);

        } catch (error) {
            console.error('❌ 获取笔记失败:', error);
            console.error('完整错误:', error.stack);

            notesList.innerHTML = `
                <li style="color:#e74c3c;background:#ffeaea;padding:20px;text-align:center;">
                    <strong>❌ 连接失败</strong><br>
                    错误: ${error.message}<br>
                    API地址: ${API_BASE}/api/notes<br><br>
                    <button onclick="location.reload()" style="padding:8px 16px;background:#e74c3c;color:white;border:none;border-radius:4px;cursor:pointer;">
                        刷新页面
                    </button>
                    <button onclick="testConnection()" style="margin-left:10px;padding:8px 16px;background:#3498db;color:white;border:none;border-radius:4px;cursor:pointer;">
                        测试连接
                    </button>
                </li>
            `;
        }
    }

    // 显示笔记
    function displayNotes(notes) {
        console.log('🎨 开始渲染笔记...');
        notesList.innerHTML = '';

        if (!notes || notes.length === 0) {
            console.log('📭 没有笔记');
            emptyMessage.style.display = 'block';
            return;
        }

        emptyMessage.style.display = 'none';
        console.log(`渲染 ${notes.length} 条笔记`);

        notes.forEach((note, index) => {
            console.log(`笔记 ${index + 1}:`, note);
            const li = document.createElement('li');

            // 格式化时间
            const time = note.createdAt
                ? new Date(note.createdAt).toLocaleString('zh-CN')
                : '未知时间';

            li.innerHTML = `
                <div class="note-content">${note.content || '无内容'}</div>
                <div class="note-footer">
                    <small class="note-time">${time}</small>
                    <button class="delete-btn" data-id="${note._id}">删除</button>
                </div>
            `;

            // 删除按钮事件
            li.querySelector('.delete-btn').addEventListener('click', function () {
                deleteNote(note._id);
            });

            notesList.appendChild(li);
        });

        console.log('✅ 笔记渲染完成');
    }

    // 保存笔记
    async function saveNote() {
        const content = noteInput.value.trim();

        if (!content) {
            alert('请输入笔记内容');
            noteInput.focus();
            return;
        }

        try {
            console.log('💾 正在保存笔记到:', `${API_BASE}/api/notes`);
            console.log('内容:', content);

            const response = await fetch(`${API_BASE}/api/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            console.log('保存响应状态:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('保存失败响应:', errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const savedNote = await response.json();
            console.log('✅ 笔记保存成功:', savedNote);

            // 清空输入框
            noteInput.value = '';

            // 刷新列表
            await fetchNotes();

            // 显示成功消息
            showMessage('笔记保存成功！', 'success');

        } catch (error) {
            console.error('❌ 保存失败:', error);
            alert('保存失败: ' + error.message);
        }
    }

    // 删除笔记
    async function deleteNote(noteId) {
        if (!confirm('确定要删除这条笔记吗？')) {
            return;
        }

        try {
            console.log('🗑️ 正在删除笔记:', `${API_BASE}/api/notes/${noteId}`);

            const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
                method: 'DELETE'
            });

            console.log('删除响应状态:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('删除失败响应:', errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                throw new Error(errorData.error || '删除失败');
            }

            const result = await response.json();
            console.log('✅ 删除成功:', result);

            // 刷新列表
            await fetchNotes();

            // 显示成功消息
            showMessage('笔记已删除！', 'success');

        } catch (error) {
            console.error('❌ 删除失败:', error);
            alert('删除失败: ' + error.message);
        }
    }

    // ========== 工具函数 ==========

    function showMessage(text, type = 'info') {
        const colors = {
            success: '#2ecc71',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || '#3498db'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        toast.textContent = text;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 全局测试函数
    window.testConnection = async function () {
        console.log('🔧 手动测试连接...');

        try {
            const testUrls = [
                `${API_BASE}/health`,
                `${API_BASE}/api/notes`,
                `${API_BASE}/`
            ];

            for (const url of testUrls) {
                console.log(`测试 ${url}...`);
                const response = await fetch(url);
                console.log(`${url}: ${response.status} ${response.statusText}`);

                if (response.ok) {
                    const data = await response.text();
                    console.log(`响应数据:`, data.substring(0, 200) + '...');
                }
            }

            // 重新获取笔记
            await fetchNotes();

        } catch (error) {
            console.error('测试连接失败:', error);
        }
    };

    // ========== 事件监听 ==========
    saveBtn.addEventListener('click', saveNote);
    noteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNote();
    });

    // ========== 初始化 ==========
    console.log('🚀 开始初始化前端...');
    fetchNotes();
    noteInput.focus();

    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        /* 添加一些基本样式 */
        .note-content {
            margin-bottom: 8px;
            font-size: 16px;
            line-height: 1.5;
        }
        .note-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }
        .note-time {
            color: #666;
        }
        .delete-btn {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.3s;
        }
        .delete-btn:hover {
            background: #c0392b;
        }
    `;
    document.head.appendChild(style);

    console.log('✅ 前端初始化完成');
});

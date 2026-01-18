// frontend/app.js - 适配MongoDB版本
// 自动检测环境
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : '/api';

document.addEventListener('DOMContentLoaded', function () {
    console.log('=== 前端启动（MongoDB版本）===');
    console.log('后端地址:', API_BASE_URL);

    const noteInput = document.getElementById('noteInput');
    const saveBtn = document.getElementById('saveBtn');
    const notesList = document.getElementById('notesList');
    const emptyMessage = document.getElementById('emptyMessage');

    // 清空显示
    notesList.innerHTML = '<li style="text-align:center;padding:20px;color:#666;">正在连接数据库...</li>';

    // ========== 核心函数 ==========

    // 从后端获取笔记（从MongoDB）
    async function fetchNotes() {
        console.log('🔍 正在从MongoDB获取数据...');

        try {
            const response = await fetch(`${API_BASE_URL}/notes`);
            console.log('响应状态:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const notes = await response.json();
            console.log('✅ MongoDB返回笔记:', notes);
            console.log('笔记数量:', notes.length);

            // 显示真实数据
            displayNotes(notes);

        } catch (error) {
            console.error('❌ 连接失败:', error.message);
            showErrorMessage(error.message);
        }
    }

    // 显示错误信息
    function showErrorMessage(message) {
        notesList.innerHTML = `
            <li style="color: #e74c3c; background: #ffeaea; padding: 30px; text-align: center;">
                <strong>❌ 数据库连接失败</strong><br>
                <small>无法连接到MongoDB数据库</small><br>
                <small>${message}</small><br>
                <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:#e74c3c;color:white;border:none;border-radius:4px;cursor:pointer;">
                    刷新页面
                </button>
            </li>
        `;
    }

    // 显示笔记（适配MongoDB格式）
    function displayNotes(notesArray) {
        console.log('🎨 开始渲染笔记:', notesArray);
        notesList.innerHTML = '';

        if (!notesArray || notesArray.length === 0) {
            console.log('📭 数据库为空');
            emptyMessage.style.display = 'block';
            return;
        }

        emptyMessage.style.display = 'none';

        notesArray.forEach((note, index) => {
            console.log(`  笔记 ${index + 1}:`, note);
            const li = document.createElement('li');

            // 格式化时间
            const createdAt = note.createdAt
                ? new Date(note.createdAt).toLocaleString('zh-CN')
                : '未知时间';

            li.innerHTML = `
                <div style="margin-bottom: 8px;">${note.content}</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <small style="color: #666;">${createdAt}</small>
                    <button class="delete-btn" data-id="${note._id}" style="background:#e74c3c;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">
                        删除
                    </button>
                </div>
            `;

            // 添加删除按钮事件
            const deleteBtn = li.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => deleteNote(note._id));

            notesList.appendChild(li);
        });
    }

    // 保存笔记到MongoDB
    async function saveNote() {
        const text = noteInput.value.trim();
        console.log('💾 尝试保存到MongoDB:', text);

        if (!text) {
            alert('请输入内容');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: text
                })
            });

            const result = await response.json();
            console.log('保存响应:', result);

            if (!response.ok) {
                throw new Error(result.error || '保存失败');
            }

            // 清空输入框
            noteInput.value = '';

            // 重新获取笔记列表
            await fetchNotes();

            // 显示成功消息
            showSuccessMessage('笔记保存成功！');

        } catch (error) {
            console.error('保存错误:', error);
            showErrorMessage('保存失败: ' + error.message);
        }
    }

    // 显示成功消息
    function showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.innerHTML = `
            <div style="position:fixed;top:20px;right:20px;background:#2ecc71;color:white;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;animation:slideInRight 0.3s ease-out;">
                ✅ ${message}
            </div>
        `;
        document.body.appendChild(successDiv);

        // 3秒后移除
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // 删除笔记（从MongoDB删除）
    async function deleteNote(noteId) {
        if (!confirm('确定要删除这条笔记吗？')) return;

        try {
            console.log('🗑️ 删除ID:', noteId);
            const response = await fetch(`${API_BASE_URL}/notes/${noteId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            console.log('删除响应:', result);

            if (!response.ok) {
                throw new Error(result.error || '删除失败');
            }

            // 重新获取笔记列表
            await fetchNotes();

            showSuccessMessage('笔记删除成功！');

        } catch (error) {
            console.error('删除错误:', error);
            showErrorMessage('删除失败: ' + error.message);
        }
    }

    // ========== 事件监听 ==========
    saveBtn.addEventListener('click', saveNote);
    noteInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') saveNote();
    });

    // ========== 初始化 ==========
    console.log('🚀 开始初始化...');
    fetchNotes();
    noteInput.focus();
    console.log('✅ 前端初始化完成');

    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
});

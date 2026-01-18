// frontend/app.js - 适配Vercel版本
document.addEventListener('DOMContentLoaded', function () {
    console.log('📝 Notebook Frontend Loading...');

    // 自动检测API地址
    const API_BASE = window.location.origin;
    console.log('🌐 Detected API Base:', API_BASE);

    const noteInput = document.getElementById('noteInput');
    const saveBtn = document.getElementById('saveBtn');
    const notesList = document.getElementById('notesList');
    const emptyMessage = document.getElementById('emptyMessage');

    // ========== 核心功能 ==========

    // 获取笔记
    async function fetchNotes() {
        console.log('🔍 Fetching notes from:', `${API_BASE}/api/notes`);

        try {
            const response = await fetch(`${API_BASE}/api/notes`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const notes = await response.json();
            console.log('📊 Notes received:', notes.length);
            displayNotes(notes);

        } catch (error) {
            console.error('❌ Failed to fetch notes:', error);
            showMessage('无法加载笔记，请检查网络连接', 'error');
            notesList.innerHTML = '<li style="color:#666;text-align:center;padding:20px;">加载失败，请刷新页面</li>';
        }
    }

    // 显示笔记
    function displayNotes(notes) {
        notesList.innerHTML = '';

        if (!notes || notes.length === 0) {
            emptyMessage.style.display = 'block';
            return;
        }

        emptyMessage.style.display = 'none';

        notes.forEach(note => {
            const li = document.createElement('li');

            // 格式化时间
            const time = note.createdAt
                ? new Date(note.createdAt).toLocaleString('zh-CN')
                : 'Unknown time';

            li.innerHTML = `
                <div class="note-content">${note.content || 'No content'}</div>
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
    }

    // 保存笔记
    async function saveNote() {
        const content = noteInput.value.trim();

        if (!content) {
            showMessage('请输入笔记内容', 'warning');
            noteInput.focus();
            return;
        }

        try {
            console.log('💾 Saving note...');

            const response = await fetch(`${API_BASE}/api/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '保存失败');
            }

            const savedNote = await response.json();
            console.log('✅ Note saved:', savedNote._id);

            // 清空输入框
            noteInput.value = '';

            // 刷新列表
            await fetchNotes();

            // 显示成功消息
            showMessage('笔记保存成功！', 'success');

        } catch (error) {
            console.error('❌ Save failed:', error);
            showMessage('保存失败: ' + error.message, 'error');
        }
    }

    // 删除笔记
    async function deleteNote(noteId) {
        if (!confirm('确定要删除这条笔记吗？')) {
            return;
        }

        try {
            console.log('🗑️ Deleting note:', noteId);

            const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '删除失败');
            }

            console.log('✅ Note deleted');

            // 刷新列表
            await fetchNotes();

            // 显示成功消息
            showMessage('笔记已删除！', 'success');

        } catch (error) {
            console.error('❌ Delete failed:', error);
            showMessage('删除失败: ' + error.message, 'error');
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

    // ========== 事件监听 ==========
    saveBtn.addEventListener('click', saveNote);
    noteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNote();
    });

    // ========== 初始化 ==========
    console.log('🚀 Initializing frontend...');
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
    `;
    document.head.appendChild(style);

    console.log('✅ Frontend initialized');
});

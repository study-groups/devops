/**
 * Admin tab module
 */

import { store } from './store.js';
import { api } from './api.js';
import { toast } from './toast.js';

export async function loadUsers() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

    try {
        const result = await api('/admin/users');

        usersList.innerHTML = '';

        result.users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
                <td>
                    <button class="action-btn delete" data-username="${user.username}">Delete</button>
                </td>
            `;
            usersList.appendChild(row);
        });

        // Add delete handlers
        usersList.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await api(`/admin/users/${btn.dataset.username}`, { method: 'DELETE' });
                    toast(`User ${btn.dataset.username} deleted`, 'success');
                    loadUsers();
                } catch (err) {
                    toast(`Delete failed: ${err.message}`, 'error');
                }
            });
        });
    } catch (err) {
        usersList.innerHTML = `<tr><td colspan="4">Error: ${err.message}</td></tr>`;
    }
}

export function init() {
    const addUserModal = document.getElementById('add-user-modal');
    const addUserForm = document.getElementById('add-user-form');
    const addUserBtn = document.getElementById('add-user-btn');

    addUserBtn.addEventListener('click', () => {
        if (!store.hasPermission('can_admin')) {
            toast('Admin access required', 'warning');
            return;
        }
        addUserModal.showModal();
    });

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await api('/admin/users', {
                method: 'POST',
                body: {
                    username: formData.get('username'),
                    password: formData.get('password'),
                    role: formData.get('role'),
                },
            });

            addUserModal.close();
            addUserForm.reset();
            toast(`User ${formData.get('username')} created`, 'success');
            loadUsers();
        } catch (err) {
            toast(`Create user failed: ${err.message}`, 'error');
        }
    });

    addUserModal.querySelector('.cancel').addEventListener('click', () => {
        addUserModal.close();
    });
}

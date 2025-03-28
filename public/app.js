document.addEventListener('DOMContentLoaded', () => {
    // Authentication elements
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const userProfile = document.getElementById('userProfile');
    const loginSection = document.getElementById('loginSection');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    // Existing elements
    const createButton = document.getElementById('createButton');
    const createModal = document.getElementById('createModal');
    const editModal = document.getElementById('editModal');
    const closeButtons = document.querySelectorAll('.close');
    const ideaForm = document.getElementById('ideaForm');
    const editForm = document.getElementById('editForm');
    const kanbanBoard = document.querySelector('.kanban-board');

    // Authentication state
    let currentUser = null;

    // Load existing ideas
    async function loadIdeas() {
        try {
            console.log('Loading ideas...');
            const response = await fetch('/api/ideas');
            console.log('Ideas response status:', response.status);
            if (response.ok) {
                const ideas = await response.json();
                console.log('Loaded ideas:', ideas);
                // Clear existing ideas
                document.querySelectorAll('.kanban-column .column-content').forEach(column => {
                    column.innerHTML = '';
                });
                // Add ideas to their respective columns
                ideas.forEach(idea => addIdeaToColumn(idea));
                setupDragAndDrop();
            } else if (response.status === 401) {
                console.log('Unauthorized - user not authenticated');
                updateUIForUnauthenticatedUser();
            } else {
                console.error('Error loading ideas:', response.status);
            }
        } catch (error) {
            console.error('Error loading ideas:', error);
        }
    }

    // Function to set up drag and drop
    function setupDragAndDrop() {
        const cards = document.querySelectorAll('.idea-card');
        const columns = document.querySelectorAll('.kanban-column');

        cards.forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });

        columns.forEach(column => {
            column.addEventListener('dragover', handleDragOver);
            column.addEventListener('drop', handleDrop);
            column.addEventListener('dragenter', handleDragEnter);
            column.addEventListener('dragleave', handleDragLeave);
        });
    }

    // Drag and drop handlers
    function handleDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.id);
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        const column = e.target.closest('.kanban-column');
        if (column) {
            column.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        e.preventDefault();
        const column = e.target.closest('.kanban-column');
        if (column) {
            column.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const column = e.target.closest('.kanban-column');
        if (!column) return;

        column.classList.remove('drag-over');
        const ideaId = e.dataTransfer.getData('text/plain');
        const card = document.querySelector(`.idea-card[data-id="${ideaId}"]`);
        if (!card) return;

        const newStatus = column.dataset.status;
        const cardStatus = card.querySelector('.status-badge').textContent;
        
        if (newStatus !== cardStatus) {
            // Update the status in the database
            fetch(`/api/ideas/${ideaId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus,
                    rating: parseInt(card.querySelector('.rating-input').value),
                    type: card.querySelector('.type-select').value
                })
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to update idea status');
                return response.json();
            })
            .then(updatedIdea => {
                // Update the card's status badge
                card.querySelector('.status-badge').textContent = newStatus;
                card.querySelector('.status-badge').className = `status-badge status-${newStatus.replace(/\s+/g, '-')}`;
            })
            .catch(error => {
                console.error('Error updating idea status:', error);
                // Revert the card to its original column
                const originalColumn = document.querySelector(`.kanban-column[data-status="${cardStatus}"] .column-content`);
                if (originalColumn) {
                    originalColumn.appendChild(card);
                }
            });
        }

        column.querySelector('.column-content').appendChild(card);
        sortCardsByRating(column.querySelector('.column-content'));
    }

    // Check authentication status on page load
    async function checkAuthStatus() {
        try {
            console.log('Checking auth status...');
            const response = await fetch('/api/user');
            if (response.ok) {
                const user = await response.json();
                console.log('Auth status response:', user);
                if (user) {
                    currentUser = user;
                    updateUIForAuthenticatedUser(user);
                } else {
                    console.log('No user found in response');
                    updateUIForUnauthenticatedUser();
                }
            } else {
                console.log('Auth status check failed:', response.status);
                updateUIForUnauthenticatedUser();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            updateUIForUnauthenticatedUser();
        }
    }

    // Update UI for authenticated user
    function updateUIForAuthenticatedUser(user) {
        userProfile.classList.remove('hidden');
        loginSection.classList.add('hidden');
        userAvatar.src = user.profile_picture;
        userName.textContent = user.display_name;
        createButton.disabled = false;
        loadIdeas(); // Load ideas when user is authenticated
    }

    // Update UI for unauthenticated user
    function updateUIForUnauthenticatedUser() {
        userProfile.classList.add('hidden');
        loginSection.classList.remove('hidden');
        createButton.disabled = true;
        // Clear the board
        document.querySelectorAll('.kanban-column .column-content').forEach(column => {
            column.innerHTML = '';
        });
    }

    // Handle login
    loginButton.addEventListener('click', () => {
        window.location.href = '/auth/google';
    });

    // Handle logout
    logoutButton.addEventListener('click', async () => {
        try {
            await fetch('/auth/logout', { method: 'GET' });
            currentUser = null;
            updateUIForUnauthenticatedUser();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    });

    // Modify createIdea to include user context
    async function createIdea(ideaData) {
        try {
            const response = await fetch('/api/ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ideaData)
            });
            if (response.ok) {
                const newIdea = await response.json();
                addIdeaToColumn(newIdea);
                createModal.style.display = 'none';
                ideaForm.reset();
            }
        } catch (error) {
            console.error('Error creating idea:', error);
        }
    }

    // Initialize the app
    checkAuthStatus();

    // Dragging functionality for modals
    const createModalContent = createModal.querySelector('.modal-content');
    const createModalHeader = createModal.querySelector('.modal-header');
    const editModalContent = editModal.querySelector('.modal-content');
    const editModalHeader = editModal.querySelector('.modal-header');
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;
    let activeModal = null;

    // Add drag event listeners for both modals
    [createModalHeader, editModalHeader].forEach(header => {
        if (header) {
            header.addEventListener('mousedown', dragStart);
        }
    });

    // Only add document-level event listeners if we have modals
    if (createModal || editModal) {
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
    }

    function dragStart(e) {
        try {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === createModalHeader || e.target.parentNode === createModalHeader) {
                isDragging = true;
                activeModal = createModalContent;
            } else if (e.target === editModalHeader || e.target.parentNode === editModalHeader) {
                isDragging = true;
                activeModal = editModalContent;
            }
        } catch (error) {
            console.error('Error in dragStart:', error);
            isDragging = false;
            activeModal = null;
        }
    }

    function drag(e) {
        if (isDragging && activeModal) {
            try {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                setTranslate(currentX, currentY, activeModal);
            } catch (error) {
                console.error('Error in drag:', error);
                isDragging = false;
                activeModal = null;
            }
        }
    }

    function dragEnd() {
        try {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            activeModal = null;
        } catch (error) {
            console.error('Error in dragEnd:', error);
            isDragging = false;
            activeModal = null;
        }
    }

    function setTranslate(xPos, yPos, el) {
        if (el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        }
    }

    // Reset modal position when opening
    function resetModalPosition() {
        try {
            xOffset = 0;
            yOffset = 0;
            if (createModalContent) {
                createModalContent.style.transform = 'translate3d(0px, 0px, 0)';
            }
            if (editModalContent) {
                editModalContent.style.transform = 'translate3d(0px, 0px, 0)';
            }
        } catch (error) {
            console.error('Error resetting modal position:', error);
        }
    }

    // Open create modal
    if (createButton) {
        createButton.addEventListener('click', () => {
            createModal.style.display = 'block';
            editModal.style.display = 'none';
            resetModalPosition();
        });
    }

    // Close modals
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            createModal.style.display = 'none';
            editModal.style.display = 'none';
            resetModalPosition();
            ideaForm.reset();
            editForm.reset();
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === createModal) {
            createModal.style.display = 'none';
            ideaForm.reset();
        }
        if (event.target === editModal) {
            editModal.style.display = 'none';
            editForm.reset();
        }
    });

    // Function to make text editable
    function makeEditable(element, originalText, ideaId, field) {
        const input = field === 'description' 
            ? document.createElement('textarea')
            : document.createElement('input');
        
        input.value = originalText;
        input.className = 'edit-input';
        
        if (field === 'description') {
            input.rows = 3;
        }

        // Replace text with input
        element.textContent = '';
        element.appendChild(input);
        input.focus();

        // Handle save on enter or blur
        const saveChanges = async () => {
            let newText = input.value.trim();
            if (newText !== originalText) {
                try {
                    // Get the current status from the card
                    const card = element.closest('.idea-card');
                    const statusBadge = card.querySelector('.status-badge');
                    const currentStatus = statusBadge.textContent;

                    // Create the update object with both the field update and current status
                    const updateData = {
                        [field]: newText,
                        status: currentStatus
                    };
                    console.log('Sending update:', updateData);

                    const response = await fetch(`/api/ideas/${ideaId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updateData)
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to update idea');
                    }
                    
                    console.log('Update successful:', data);
                    // Update was successful
                    element.textContent = newText;
                } catch (error) {
                    console.error('Error updating idea:', error);
                    alert('Failed to update idea. Please try again.');
                    element.textContent = originalText;
                }
            } else {
                // No changes made, revert to original text
                element.textContent = originalText;
            }
        };

        input.addEventListener('blur', saveChanges);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && field !== 'description') {
                e.preventDefault();
                input.blur();
            }
        });
    }

    // Function to sort cards by rating within a column
    function sortCardsByRating(columnContent) {
        const cards = Array.from(columnContent.children);
        cards.sort((a, b) => {
            const ratingA = parseInt(a.querySelector('.rating-input').value);
            const ratingB = parseInt(b.querySelector('.rating-input').value);
            return ratingB - ratingA; // Sort in descending order (highest rating first)
        });
        
        // Clear and re-append sorted cards
        cards.forEach(card => columnContent.appendChild(card));
    }

    // Handle edit form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            title: document.getElementById('editTitle').value,
            description: document.getElementById('editDescription').value,
            rating: parseInt(document.getElementById('editRating').value),
            type: document.getElementById('editType').value,
            status: document.getElementById('editStatus').value
        };

        const ideaId = document.getElementById('editId').value;
        console.log('Submitting edit form:', { ideaId, formData });

        try {
            const response = await fetch(`/api/ideas/${ideaId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to update idea');
            }
            
            // Update the card in the UI using the server's response data
            const card = document.querySelector(`.idea-card[data-id="${ideaId}"]`);
            if (card) {
                console.log('Updating card in UI:', card);
                // Update card content using server response data
                const titleElement = card.querySelector('.card-title');
                const descriptionElement = card.querySelector('.card-description');
                const ratingInput = card.querySelector('.rating-input');
                const typeSelect = card.querySelector('.type-select');
                const statusBadge = card.querySelector('.status-badge');

                if (titleElement) titleElement.textContent = responseData.title;
                if (descriptionElement) descriptionElement.textContent = responseData.description;
                if (ratingInput) ratingInput.value = responseData.rating;
                if (typeSelect) typeSelect.value = responseData.type;
                if (statusBadge) {
                    statusBadge.textContent = responseData.status;
                    statusBadge.className = `status-badge status-${responseData.status.replace(/\s+/g, '-')}`;
                }

                // Sort cards in the column
                const columnContent = card.closest('.column-content');
                if (columnContent) {
                    sortCardsByRating(columnContent);
                }
            } else {
                console.error('Card not found in UI:', ideaId);
            }

            // Close the modal
            editModal.style.display = 'none';
        } catch (error) {
            console.error('Error updating idea:', error);
            alert('Failed to update idea. Please try again.');
        }
    });

    // Function to open edit modal
    async function openEditModal(idea) {
        try {
            // Fetch the latest data from the server
            const response = await fetch(`/api/ideas/${idea.id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch idea data');
            }
            const latestIdea = await response.json();
            console.log('Fetched latest idea data:', latestIdea);

            // Populate the form with the latest data
            document.getElementById('editId').value = latestIdea.id;
            document.getElementById('editTitle').value = latestIdea.title;
            document.getElementById('editDescription').value = latestIdea.description;
            document.getElementById('editRating').value = latestIdea.rating;
            document.getElementById('editType').value = latestIdea.type;
            document.getElementById('editStatus').value = latestIdea.status;
            
            // Format and display timestamps
            const formatDate = (dateString) => {
                const date = new Date(dateString);
                return date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            };
            
            document.getElementById('editCreatedAt').textContent = formatDate(latestIdea.created_at);
            document.getElementById('editUpdatedAt').textContent = formatDate(latestIdea.updated_at);
            
            // Load tasks for this idea
            await loadTasks(latestIdea.id);
            
            editModal.style.display = 'block';
            resetModalPosition();
        } catch (error) {
            console.error('Error opening edit modal:', error);
            alert('Failed to load idea data. Please try again.');
        }
    }

    // Function to load tasks for an idea
    async function loadTasks(ideaId) {
        try {
            const response = await fetch(`/api/ideas/${ideaId}/tasks`);
            if (!response.ok) {
                throw new Error('Failed to load tasks');
            }
            const tasks = await response.json();
            displayTasks(tasks);
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    // Function to display tasks in the modal
    function displayTasks(tasks) {
        const tasksList = document.getElementById('tasksList');
        tasksList.innerHTML = '';

        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            tasksList.appendChild(taskElement);
        });
    }

    // Function to create a task element
    function createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item ${task.status === 'Done' ? 'completed' : ''}`;
        taskDiv.dataset.taskId = task.id;

        const formatDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        taskDiv.innerHTML = `
            <div class="task-content">
                <span class="task-name">${task.name}</span>
                ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                ${task.due_date ? `<span class="task-due-date">Due: ${formatDate(task.due_date)}</span>` : ''}
            </div>
            <div class="task-actions">
                <select class="task-status-select">
                    <option value="To Do" ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
                    <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Done" ${task.status === 'Done' ? 'selected' : ''}>Done</option>
                </select>
                <button class="delete-task-button">×</button>
            </div>
        `;

        // Add event listeners
        const statusSelect = taskDiv.querySelector('.task-status-select');
        statusSelect.addEventListener('change', () => updateTaskStatus(task.id, statusSelect.value));

        const deleteButton = taskDiv.querySelector('.delete-task-button');
        deleteButton.addEventListener('click', () => deleteTask(task.id));

        return taskDiv;
    }

    // Function to toggle task status
    async function toggleTaskStatus(task) {
        const statusOrder = ['To Do', 'In Progress', 'Done'];
        const currentIndex = statusOrder.indexOf(task.task_status);
        const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ task_status: nextStatus })
            });

            if (!response.ok) {
                throw new Error('Failed to update task status');
            }

            const updatedTask = await response.json();
            const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
            if (taskElement) {
                taskElement.replaceWith(createTaskElement(updatedTask));
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            alert('Failed to update task status. Please try again.');
        }
    }

    // Function to delete a task
    async function deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete task');
            }

            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                taskElement.remove();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Failed to delete task. Please try again.');
        }
    }

    // Add event listener for the add task button
    document.getElementById('addTaskButton').addEventListener('click', async () => {
        const taskNameInput = document.getElementById('newTaskName');
        const taskDueDateInput = document.getElementById('newTaskDueDate');
        const ideaId = document.getElementById('editId').value;

        if (!taskNameInput.value.trim()) {
            alert('Please enter a task name');
            return;
        }

        const taskData = {
            name: taskNameInput.value.trim(),
            due_date: taskDueDateInput.value || null,
            status: 'To Do'
        };

        console.log('Creating task for idea:', ideaId);
        console.log('Task data:', taskData);

        try {
            const response = await fetch(`/api/ideas/${ideaId}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to create task');
            }

            const tasksList = document.getElementById('tasksList');
            tasksList.appendChild(createTaskElement(responseData));

            // Clear and reset the input fields
            taskNameInput.value = '';
            taskDueDateInput.value = '';
            
            // Focus back on the task name input for quick entry of next task
            taskNameInput.focus();
        } catch (error) {
            console.error('Error creating task:', error);
            alert('Failed to create task. Please try again.');
        }
    });

    // Add event listener for Enter key in task name input
    document.getElementById('newTaskName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('addTaskButton').click();
        }
    });

    // Function to create idea card
    function createIdeaCard(idea) {
        const card = document.createElement('div');
        card.className = 'idea-card';
        card.draggable = true;
        card.dataset.id = idea.id;
        
        // Create the type dropdown
        const typeOptions = ['WebApp', 'Software', 'Embedded', 'Physical Product', 'Service']
            .map(type => `<option value="${type}" ${idea.type === type ? 'selected' : ''}>${type}</option>`)
            .join('');
        
        card.innerHTML = `
            <div class="card-header">
                <h3 class="card-title" data-field="title">${idea.title}</h3>
                <div class="card-header-right">
                    <input type="number" class="rating-input" data-field="rating" 
                           value="${idea.rating || 50}" min="1" max="100">
                    <span class="toggle-icon">▼</span>
                </div>
            </div>
            <div class="card-content">
                <p class="card-description" data-field="description">${idea.description}</p>
                <div class="card-details">
                    <div class="type-container">
                        <label>Type:</label>
                        <select class="type-select" data-field="type">
                            ${typeOptions}
                        </select>
                    </div>
                    <span class="status-badge status-${idea.status.replace(/\s+/g, '-')}">${idea.status}</span>
                </div>
            </div>
        `;

        // Add drag and drop event listeners
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        // Add double-click handler for edit modal
        card.addEventListener('dblclick', () => {
            openEditModal(idea);
        });

        // Add click listeners for editing
        const titleElement = card.querySelector('.card-title');
        const descriptionElement = card.querySelector('.card-description');
        const ratingInput = card.querySelector('.rating-input');
        const typeSelect = card.querySelector('.type-select');
        const toggleIcon = card.querySelector('.toggle-icon');
        const cardContent = card.querySelector('.card-content');

        // Add toggle functionality
        toggleIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent double-click when clicking the toggle
            card.classList.toggle('collapsed');
            toggleIcon.textContent = card.classList.contains('collapsed') ? '▶' : '▼';
        });

        titleElement.addEventListener('dblclick', () => {
            makeEditable(titleElement, idea.title, idea.id, titleElement.dataset.field);
        });

        descriptionElement.addEventListener('dblclick', () => {
            makeEditable(descriptionElement, idea.description, idea.id, descriptionElement.dataset.field);
        });

        // Add change listeners for rating and type
        ratingInput.addEventListener('change', async () => {
            const newRating = parseInt(ratingInput.value);
            if (newRating >= 1 && newRating <= 100) {
                try {
                    const response = await fetch(`/api/ideas/${idea.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            rating: newRating,
                            status: card.querySelector('.status-badge').textContent
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update rating');
                    }

                    // Sort cards in the column after rating update
                    const columnContent = card.closest('.column-content');
                    sortCardsByRating(columnContent);
                } catch (error) {
                    console.error('Error:', error);
                    alert('Failed to update rating. Please try again.');
                    ratingInput.value = idea.rating || 50;
                }
            } else {
                alert('Rating must be between 1 and 100');
                ratingInput.value = idea.rating || 50;
            }
        });

        typeSelect.addEventListener('change', async () => {
            try {
                const response = await fetch(`/api/ideas/${idea.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: typeSelect.value,
                        status: card.querySelector('.status-badge').textContent
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to update type');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to update type. Please try again.');
                typeSelect.value = idea.type;
            }
        });

        return card;
    }

    // Handle form submission
    ideaForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            rating: parseInt(document.getElementById('rating').value),
            type: document.getElementById('type').value,
            status: document.getElementById('status').value
        };

        try {
            const response = await fetch('/api/ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create idea');
            }

            const newIdea = await response.json();
            addIdeaToColumn(newIdea);
            
            // Reset form and close modal
            ideaForm.reset();
            createModal.style.display = 'none';

        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        }
    });

    // Function to add idea to appropriate column
    function addIdeaToColumn(idea) {
        console.log('Adding idea to column:', idea);
        // Normalize the status to match the column data-status attributes
        let normalizedStatus = idea.status.trim();
        console.log('Normalized status:', normalizedStatus);
        
        // Map old status values to new ones (case-insensitive)
        const statusMap = {
            'draft': 'To Do',
            'todo': 'To Do',
            'to-do': 'To Do',
            'to do': 'To Do',
            'in-progress': 'In Progress',
            'inprogress': 'In Progress',
            'in progress': 'In Progress',
            'completed': 'Done',
            'done': 'Done',
            'complete': 'Done',
            'archived': 'Archived',
            'archive': 'Archived'
        };
        
        // Convert to lowercase for case-insensitive matching
        const statusKey = normalizedStatus.toLowerCase();
        console.log('Status key:', statusKey);
        
        // If the status is in our map, use the new value
        if (statusMap[statusKey]) {
            normalizedStatus = statusMap[statusKey];
            console.log('Mapped status to:', normalizedStatus);
        }
        
        // Try to find the matching column
        let column = document.querySelector(`.kanban-column[data-status="${normalizedStatus}"] .column-content`);
        console.log('Found column:', column);
        
        // If no column found, try case-insensitive match
        if (!column) {
            const columns = document.querySelectorAll('.kanban-column');
            console.log('Available columns:', Array.from(columns).map(col => col.dataset.status));
            for (const col of columns) {
                if (col.dataset.status.toLowerCase() === normalizedStatus.toLowerCase()) {
                    column = col.querySelector('.column-content');
                    normalizedStatus = col.dataset.status; // Use the exact case from the column
                    console.log('Found column with case-insensitive match:', column);
                    break;
                }
            }
        }
        
        // If still no column found, default to "To Do"
        if (!column) {
            console.warn(`No column found for status: ${normalizedStatus}, defaulting to "To Do"`);
            column = document.querySelector('.kanban-column[data-status="To Do"] .column-content');
            if (!column) {
                console.error('Default "To Do" column not found');
                return;
            }
            // Update the idea's status to match the default column
            normalizedStatus = 'To Do';
            // Update the status in the database
            fetch(`/api/ideas/${idea.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: normalizedStatus,
                    rating: idea.rating,
                    type: idea.type
                })
            }).catch(error => console.error('Error updating idea status:', error));
        }

        const card = createIdeaCard({...idea, status: normalizedStatus});
        console.log('Created card:', card);
        column.appendChild(card);
        sortCardsByRating(column);
    }

    // Backup and Restore functionality
    document.getElementById('backupButton').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/backup');
            if (!response.ok) {
                throw new Error('Failed to create backup');
            }
            const backupData = await response.json();
            
            // Create a blob and download the file
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ideasoup-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            alert('Backup created successfully!');
        } catch (error) {
            console.error('Error creating backup:', error);
            alert('Failed to create backup. Please try again.');
        }
    });

    document.getElementById('restoreButton').addEventListener('click', () => {
        document.getElementById('restoreFile').click();
    });

    document.getElementById('restoreFile').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const backupData = JSON.parse(e.target.result);
                    
                    // Validate backup data
                    if (!backupData.version || !backupData.ideas || !Array.isArray(backupData.ideas)) {
                        throw new Error('Invalid backup file format');
                    }

                    // Confirm with user
                    if (!confirm(`This will replace all your current ideas and tasks with the backup data. Are you sure you want to continue?`)) {
                        return;
                    }

                    const response = await fetch('/api/restore', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(backupData)
                    });

                    if (!response.ok) {
                        throw new Error('Failed to restore backup');
                    }

                    const result = await response.json();
                    alert(`Backup restored successfully! ${result.ideasRestored} ideas and ${result.tasksRestored} tasks restored.`);
                    
                    // Refresh the page to show restored data
                    window.location.reload();
                } catch (error) {
                    console.error('Error restoring backup:', error);
                    alert('Failed to restore backup. Please make sure you selected a valid backup file.');
                }
            };
            reader.readAsText(file);
        } catch (error) {
            console.error('Error reading backup file:', error);
            alert('Failed to read backup file. Please try again.');
        }
    });
}); // End of DOMContentLoaded event listener 
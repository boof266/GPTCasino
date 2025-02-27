document.addEventListener('DOMContentLoaded', async function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    let userBalance = 0; // Initialize userBalance here
    const userBalanceDisplay = document.getElementById('userBalance'); // Initialize userBalanceDisplay here

    // Show Roulette tab if logged in and update balance
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('rouletteTab').style.display = 'block';
        await updateUserBalance(user.id); // Fetch and display user balance on page load
    } else {
        document.getElementById('rouletteTab').style.display = 'none';
    }

    // Function to update user balance from the database
    async function updateUserBalance(userId) {
        const response = await fetch(`http://localhost:3001/api/balance/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (response.ok) {
            userBalance = parseFloat(data.balance); // Update user balance from the database
            userBalanceDisplay.textContent = `$${userBalance.toFixed(2)}`; // Display updated balance
        } else {
            console.error('Failed to fetch balance:', data.error);
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            if (!username || !password) {
                showError('Please fill in all fields');
                return;
            }

            try {
                const response = await fetch('http://localhost:3001/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                
                if (response.ok) {
                    // Fetch user balance from the database
                    await updateUserBalance(data.id); // Update balance immediately after login

                    // Store user data in localStorage
                    localStorage.setItem('user', JSON.stringify(data));
                    window.location.href = 'roulette.html'; // Redirect to Roulette page

                } else {
                    alert(data.error || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('An error occurred during login');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const password = document.getElementById('regPassword').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();

            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            console.log('Registration request:', { username, password });
            try {
                const response = await fetch('http://localhost:3001/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                console.log('Response status:', response.status);
                const data = await response.json();
                
                if (response.ok) {
                    alert('Registration successful! Please login.');
                    document.getElementById('showLogin').click();
                } else {
                    console.log('Registration error response:', data);
                    alert(data.error || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('An error occurred during registration');
            }
        });
    }

    // Roulette game logic
    const wheel = document.getElementById('wheel');
    const betAmountInput = document.getElementById('betAmount');
    const betAmountDisplay = document.getElementById('betAmountDisplay');
    const gameMessages = document.getElementById('gameMessages');

    let currentBet = 0; // Start with 0 and update after login
    let selectedColor = null; // Track the selected color for betting
    let isSpinning = false; // Track if the spinner is currently spinning
    const placeBetButton = document.getElementById('placeBet'); // Reference to the place bet button

    // Display initial balance
    userBalanceDisplay.textContent = `$${userBalance.toFixed(2)}`;

    document.getElementById('betRed').addEventListener('click', function() {
        selectedColor = 'red';
        gameMessages.textContent = `You have selected to bet on Red.`;
    });

    document.getElementById('betBlack').addEventListener('click', function() {
        selectedColor = 'black';
        gameMessages.textContent = `You have selected to bet on Black.`;
    });

    placeBetButton.addEventListener('click', async function() {
        if (isSpinning) {
            console.log('Bet placement ignored: spinner is currently active.');
            return; // Prevent placing a bet if the spinner is active
        }
        isSpinning = true; // Set spinner state to active
        placeBetButton.disabled = true; // Disable the place bet button

        const betAmount = parseFloat(betAmountInput.value);
        if (isNaN(betAmount) || betAmount <= 0 || betAmount > userBalance) {
            alert('Please enter a valid bet amount.');
            isSpinning = false; // Reset spinner state if bet is invalid
            placeBetButton.disabled = false; // Re-enable the place bet button
            return;
        }
        currentBet = betAmount;
        betAmountDisplay.textContent = currentBet;
        gameMessages.textContent = `You have placed a bet of $${currentBet} on ${selectedColor}.`;

        // Spin the wheel
        const spinDuration = 3000; // Reduced spin duration for quicker feedback

        const spinResult = Math.floor(Math.random() * 2); // Simulate a spin result (0 for red, 1 for black)
        const resultColor = spinResult === 0 ? 'red' : 'black';
        
        // Calculate final rotation (5 full rotations + random offset)
        const fullRotations = 5;
        const randomOffset = Math.floor(Math.random() * 360);
        const finalRotation = (360 * fullRotations) + randomOffset;
        
        // Apply rotation with CSS transition
        wheel.style.transition = `transform ${spinDuration}ms ease-out`;
        wheel.style.transform = `rotate(${finalRotation}deg)`;
        
        // Handle spin completion
        setTimeout(async () => {
            console.log('Spinner stopped.');
            isSpinning = false; // Reset spinner state
            placeBetButton.disabled = false; // Re-enable the place bet button
            
            // Highlight the winning lane
            const lanes = document.querySelectorAll('.lane');
            lanes.forEach(lane => lane.classList.remove('winning'));
            lanes[spinResult * 5].classList.add('winning');

            gameMessages.textContent = `The wheel has spun! Result: ${resultColor}`;

            // Update balance based on the result and send to the server
            const amountToUpdate = resultColor === selectedColor ? currentBet : -currentBet;
            userBalance = parseFloat((userBalance + amountToUpdate).toFixed(2)); // Update user balance locally

            // Log the transaction in the database
            await fetch('http://localhost:3001/api/log-transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: user.id, amount: amountToUpdate, type: resultColor === selectedColor ? 'win' : 'bet' }) // Use 'type' instead of 'result'
            });

            // Update the balance in the database
            await fetch('http://localhost:3001/api/update-balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: user.id, amount: amountToUpdate }) // Send the correct amount to update
            });

            userBalanceDisplay.textContent = `$${userBalance.toFixed(2)}`; // Update displayed balance
            currentBet = 0; // Reset bet after spinning
            betAmountInput.value = ''; // Clear input
            selectedColor = null; // Reset selected color
        }, spinDuration); // Wait for the spin duration before showing the result
    });

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                const response = await fetch('http://localhost:3001/api/logout', {
                    method: 'POST'
                });

                if (response.ok) {
                    localStorage.removeItem('user');
                    window.location.href = 'index.html';
                } else {
                    alert('Logout failed');
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('An error occurred during logout');
            }
        });
    }
});

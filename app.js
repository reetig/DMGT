const quizContainer = document.querySelector('.question-container');
const questionText = document.getElementById('question-text');
const questionNumber = document.getElementById('question-number');
const options = document.querySelectorAll('.option');
const timeLeft = document.getElementById('time-left');

let currentQuestionIndex = 0;
let quizData = [];

// Fetch quiz data from backend
async function fetchQuizData() {
    try {
        const response = await fetch('http://localhost:5000/api/quizzes/your-quiz-id'); // Replace 'your-quiz-id' with actual quiz ID
        const data = await response.json();
        quizData = data.questions;
        displayQuestion();
    } catch (error) {
        console.error('Error fetching quiz data:', error);
    }
}

// Display question based on index
function displayQuestion() {
    const question = quizData[currentQuestionIndex];
    questionNumber.innerText = `Question ${currentQuestionIndex + 1}`;
    questionText.innerText = question.questionText;

    options.forEach((option, index) => {
        option.innerText = question.options[index].text;
        option.onclick = () => selectOption(index);
    });
}

// Select answer
function selectOption(selectedIndex) {
    const isCorrect = quizData[currentQuestionIndex].options[selectedIndex].isCorrect;
    if (isCorrect) {
        alert('Correct!');
    } else {
        alert('Incorrect!');
    }
    nextQuestion();
}

// Navigation functions
function nextQuestion() {
    if (currentQuestionIndex < quizData.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        alert('Quiz Complete!');
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

// Timer
let timer = 180; // 3 minutes
setInterval(() => {
    if (timer > 0) {
        timer--;
        timeLeft.innerText = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`;
    } else {
        alert('Time is up!');
    }
}, 1000);

// Initialize
fetchQuizData();

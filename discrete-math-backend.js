// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost/discrete-math-quiz', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Topic Schema - For organizing questions by mathematical concepts
const topicSchema = new mongoose.Schema({
  name: String,
  category: {
    type: String,
    enum: ['Set Theory', 'Logic', 'Relations', 'Functions', 'Graph Theory', 'Trees',
      'Boolean Algebra', 'Combinatorics', 'Probability']
  },
  description: String,
  difficulty: {
    type: String,
    enum: ['Basic', 'Intermediate', 'Advanced']
  }
});

const Topic = mongoose.model('Topic', topicSchema);

// Question Schema with support for different question types
const questionSchema = new mongoose.Schema({
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  type: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'graph_drawing', 'proof', 'calculation']
  },
  difficulty: {
    type: String,
    enum: ['Basic', 'Intermediate', 'Advanced']
  },
  questionText: String,
  images: [String], // For storing graph diagrams or mathematical figures
  options: [{
    text: String,
    isCorrect: Boolean,
    explanation: String
  }],
  // For proof and calculation questions
  solution: {
    steps: [String],
    finalAnswer: String
  },
  // For graph theory questions
  graphData: {
    vertices: [String],
    edges: [{
      from: String,
      to: String,
      weight: Number
    }],
    isDirected: Boolean
  },
  hints: [String],
  explanation: String,
  points: Number
});

const Question = mongoose.model('Question', questionSchema);

// Quiz Schema
const quizSchema = new mongoose.Schema({
  title: String,
  topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
  difficulty: {
    type: String,
    enum: ['Basic', 'Intermediate', 'Advanced', 'Mixed']
  },
  duration: Number, // in minutes
  totalPoints: Number,
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Quiz = mongoose.model('Quiz', quizSchema);

// Submission Schema with detailed analysis
const submissionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  answers: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedOption: String,
    isCorrect: Boolean,
    pointsEarned: Number
  }],
  topicWiseAnalysis: [{
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
    correctAnswers: Number,
    totalQuestions: Number,
    performance: Number // percentage
  }],
  totalScore: Number,
  percentage: Number,
  timeTaken: Number, // in minutes
  submittedAt: { type: Date, default: Date.now }
});

const Submission = mongoose.model('Submission', submissionSchema);

// Routes

// Topic Routes
app.post('/api/topics', async (req, res) => {
  try {
    const topic = new Topic(req.body);
    await topic.save();
    res.status(201).json(topic);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/topics', async (req, res) => {
  try {
    const topics = await Topic.find();
    res.json(topics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Question Routes
app.post('/api/questions', async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/questions', async (req, res) => {
  try {
    const { topic, difficulty, type } = req.query;
    const query = {};
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;
    if (type) query.type = type;

    const questions = await Question.find(query).populate('topic');
    res.json(questions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Quiz Routes
app.post('/api/quizzes', async (req, res) => {
  try {
    const quiz = new Quiz(req.body);
    // Calculate total points
    quiz.totalPoints = (await Question.find({
      '_id': { $in: quiz.questions }
    })).reduce((sum, q) => sum + q.points, 0);

    await quiz.save();
    res.status(201).json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/quizzes/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('questions')
      .populate('topics');
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submission Routes
app.post('/api/submissions', async (req, res) => {
  try {
    const { quizId, answers } = req.body;
    const quiz = await Quiz.findById(quizId).populate('questions');

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Calculate scores and analysis
    let totalScore = 0;
    const analyzedAnswers = [];
    const topicAnalysis = new Map();

    for (const answer of answers) {
      const question = quiz.questions.find(q => q._id.toString() === answer.questionId);
      const isCorrect = question.options.find(opt => opt.isCorrect)._id.toString() === answer.selectedOption;
      const pointsEarned = isCorrect ? question.points : 0;

      analyzedAnswers.push({
        question: question._id,
        selectedOption: answer.selectedOption,
        isCorrect,
        pointsEarned
      });

      totalScore += pointsEarned;

      // Update topic analysis
      const topicId = question.topic.toString();
      if (!topicAnalysis.has(topicId)) {
        topicAnalysis.set(topicId, { correct: 0, total: 0 });
      }
      const topic = topicAnalysis.get(topicId);
      topic.total++;
      if (isCorrect) topic.correct++;
    }

    // Convert topic analysis to array format
    const topicWiseAnalysis = Array.from(topicAnalysis.entries()).map(([topicId, data]) => ({
      topic: topicId,
      correctAnswers: data.correct,
      totalQuestions: data.total,
      performance: (data.correct / data.total) * 100
    }));

    const submission = new Submission({
      quiz: quizId,
      answers: analyzedAnswers,
      topicWiseAnalysis,
      totalScore,
      percentage: (totalScore / quiz.totalPoints) * 100,
      timeTaken: req.body.timeTaken
    });

    await submission.save();
    res.status(201).json(submission);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get submission analytics
app.get('/api/submissions/analytics/:quizId', async (req, res) => {
  try {
    const submissions = await Submission.find({ quiz: req.params.quizId })
      .populate('quiz')
      .populate('topicWiseAnalysis.topic');

    const analytics = {
      totalSubmissions: submissions.length,
      averageScore: submissions.reduce((sum, sub) => sum + sub.percentage, 0) / submissions.length,
      topicWisePerformance: {},
      difficultyDistribution: {
        Basic: 0,
        Intermediate: 0,
        Advanced: 0
      }
    };

    // Calculate topic-wise and difficulty-wise analytics
    submissions.forEach(submission => {
      submission.topicWiseAnalysis.forEach(analysis => {
        const topicName = analysis.topic.name;
        if (!analytics.topicWisePerformance[topicName]) {
          analytics.topicWisePerformance[topicName] = [];
        }
        analytics.topicWisePerformance[topicName].push(analysis.performance);
      });
    });

    // Calculate averages for topic-wise performance
    Object.keys(analytics.topicWisePerformance).forEach(topic => {
      const performances = analytics.topicWisePerformance[topic];
      analytics.topicWisePerformance[topic] =
        performances.reduce((sum, perf) => sum + perf, 0) / performances.length;
    });

    res.json(analytics);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

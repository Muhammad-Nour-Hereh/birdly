import {
  MatchQuestion,
  OrderQuestion,
  Question,
  SelectQuestion,
  WriteQuestion,
} from '@/interfaces/Question'
import { remote } from '@/remotes/remotes'
import { createContext, useContext, useEffect, useState } from 'react'

export type QuizContext = {
  loading: boolean
  curQuestion: Question | null
  progressPercent: number
  nextQuestion: () => void
  setWriteAnswer: Function
  setSelectAnswer: Function
  setOrderAnswer: Function
  setMatchAnswer: Function
  checkAnswer: Function
  correctAnswer: string
  checkable: boolean
}

const quizContext = createContext<QuizContext | undefined>(undefined)

const QuizProvider = ({ children }: any) => {
  // const [curLevel, setCurLevel] = useState(1)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  const [index, setIndex] = useState(0)
  const [questionCount, setQuestionCount] = useState(0)
  const [curQuestion, setCurQuestion] = useState<Question | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [checkable, setCheckable] = useState(false)

  // answers states
  const [writeAnswer, setWriteAnswer] = useState('')
  const [selectAnswer, setSelectAnswer] = useState('')
  const [orderAnswer, setOrderAnswer] = useState<string[]>([])
  const [matchAnswer, setMatchAnswer] = useState({ left: '', right: '' })

  const progressPercent = (index / questionCount) * 100

  const nextQuestion = () => {
    if (questionCount === 0) return
    setIndex((prev) => (prev + 1) % questionCount)
  }

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true)
      const res = await remote.level.getQuestions(1)
      if (res.success === 'true' && res.data) {
        setQuestions(res.data)
      }
      setLoading(false)
    }

    fetchQuestions()
  }, [])

  // when questions are returned
  useEffect(() => {
    setIndex(0)
    setQuestionCount(questions.length)
    setCurQuestion(questions[0])
    console.log('Questions useEffect fired', {
      questions,
      length: questions.length,
      first: questions[0],
    })
  }, [questions])

  useEffect(() => {
    const _curQuestion = questions[index]
    if (!_curQuestion) return

    setCurQuestion(_curQuestion)

    switch (_curQuestion.type) {
      case 'select':
      case 'write':
        setCorrectAnswer(_curQuestion.content.correctAnswer)
        break
      case 'order':
        setCorrectAnswer(JSON.stringify(_curQuestion.content.correctOrder))
        break
      default:
        setCorrectAnswer('')
    }

    setCheckable(false)
    console.log({ curQuestion: _curQuestion })
  }, [index, questions])

  useEffect(() => {
    console.log(matchAnswer)
    if (matchAnswer.left !== '' && matchAnswer.right !== '')
      console.log(checkAnswer())
  }, [matchAnswer])

  const checkAnswer = async (): Promise<
    'correct' | 'wrong' | 'almost' | undefined
  > => {
    if (!curQuestion) return
    switch (curQuestion.type) {
      case 'write': {
        const { correctAnswer } = (curQuestion as WriteQuestion).content

        if (writeAnswer.trim() === correctAnswer) return 'correct'
        setCorrectAnswer(correctAnswer)

        const res = await remote.question.check(
          writeAnswer.trim(),
          curQuestion.id,
        )
        // ai check
        return res.data ? 'almost' : 'wrong'
      }

      case 'select': {
        const { correctAnswer } = (curQuestion as SelectQuestion).content
        return selectAnswer === correctAnswer ? 'correct' : 'wrong'
      }

      case 'order': {
        const { correctOrder } = (curQuestion as OrderQuestion).content
        return orderAnswer.join('') === correctOrder.join('')
          ? 'correct'
          : 'wrong'
      }

      case 'match': {
        const { pairs } = (curQuestion as MatchQuestion).content

        const matchIndex = pairs.findIndex(
          ({ left, right }) =>
            left === matchAnswer.left && right === matchAnswer.right,
        )

        if (matchIndex !== -1) {
          // Mark as selected
          pairs[matchIndex].selected = true
        }

        const match = matchIndex !== -1
        setMatchAnswer({ left: '', right: '' }) // Reset selection
        return match ? 'correct' : 'wrong'
      }

      default:
        return 'wrong'
    }
  }

  // set checkable when select an answer
  useEffect(() => {
    setCheckable(writeAnswer !== '')
  }, [writeAnswer])
  useEffect(() => {
    setCheckable(selectAnswer !== '')
  }, [selectAnswer])
  useEffect(() => {
    setCheckable(orderAnswer.length > 0)
  }, [orderAnswer])
  useEffect(() => {
    setCheckable(true)
  }, [matchAnswer])

  return (
    <quizContext.Provider
      value={{
        loading,
        curQuestion,
        progressPercent,
        correctAnswer,
        nextQuestion,
        setWriteAnswer,
        setSelectAnswer,
        setOrderAnswer,
        setMatchAnswer,
        checkAnswer,
        checkable,
      }}>
      {children}
    </quizContext.Provider>
  )
}

export const useQuiz = (): QuizContext => {
  const context = useContext(quizContext)

  if (!context) {
    throw Error('useQuiz hook can only be used in an QuizProvider context')
  }

  return context
}

export default QuizProvider

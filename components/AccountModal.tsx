'use client'

import { useState, useEffect } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from 'react-i18next'

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { firstName, lastName, username, updateProfile, changePassword } = useAuth()
  const { t } = useTranslation()
  const [firstNameInput, setFirstNameInput] = useState('')
  const [lastNameInput, setLastNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    if (firstName) setFirstNameInput(firstName)
    if (lastName) setLastNameInput(lastName)
    // Get email from localStorage since it's not in the auth context yet
    const savedUser = localStorage.getItem('userData')
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        if (userData.email) setEmailInput(userData.email)
      } catch (error) {
        console.error('Failed to parse saved user data:', error)
      }
    }
  }, [firstName, lastName])

  if (!isOpen) return null

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    return regex.test(password)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.passwordsDoNotMatch'))
      return
    }
    
    // Validate password strength
    if (!validatePassword(newPassword)) {
      setPasswordError(t('auth.passwordRequirements'))
      return
    }
    
    try {
      const result = await changePassword(currentPassword, newPassword)
      
      if (result.success) {
        setPasswordSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          setPasswordSuccess(false)
        }, 3000)
      } else {
        setPasswordError(result.error || t('auth.passwordChangeFailed'))
      }
    } catch (error) {
      console.error('Password change error:', error)
      setPasswordError(t('auth.passwordChangeError'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const success = await updateProfile(firstNameInput.trim(), lastNameInput.trim(), emailInput.trim())
      
      if (success) {
        onClose()
      } else {
        alert(t('auth.profileUpdateFailed'))
      }
    } catch (error) {
      console.error('AccountModal: Error during update', error)
      alert(t('auth.profileUpdateError'))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('auth.accountSettings')}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 -mb-px font-medium text-sm transition-colors ${
              activeTab === 'profile'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('auth.profile')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2 -mb-px font-medium text-sm transition-colors ${
              activeTab === 'password'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('auth.changePassword')}
          </button>
        </div>
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.firstName')}
            </label>
            <input
              id="firstName"
              type="text"
              value={firstNameInput}
              onChange={(e) => setFirstNameInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.lastName')}
            </label>
            <input
              id="lastName"
              type="text"
              value={lastNameInput}
              onChange={(e) => setLastNameInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.emailAddress')}
            </label>
            <input
              id="email"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('auth.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              {t('auth.save')}
            </button>
          </div>
        </form>
        )}
        
        {/* Password Tab */}
        {activeTab === 'password' && (
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.currentPassword')}
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {showCurrentPassword ? (
                  <EyeOff size={18} className="text-gray-500 dark:text-gray-400" />
                ) : (
                  <Eye size={18} className="text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.newPassword')}
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {showNewPassword ? (
                  <EyeOff size={18} className="text-gray-500 dark:text-gray-400" />
                ) : (
                  <Eye size={18} className="text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.confirmNewPassword')}
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} className="text-gray-500 dark:text-gray-400" />
                ) : (
                  <Eye size={18} className="text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('auth.passwordRequirements')}
          </div>
          
          {passwordError && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {passwordError}
            </div>
          )}
          
          {passwordSuccess && (
            <div className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm">
              {t('auth.passwordChangeSuccess')}
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('auth.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              {t('auth.changePassword')}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
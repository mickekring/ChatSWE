'use client'

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Model } from '@/lib/types'
import { clsx } from 'clsx'

interface ModelSelectorProps {
  models: Model[]
  selectedModel: Model
  onSelectModel: (model: Model) => void
}

export default function ModelSelector({ models, selectedModel, onSelectModel }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {selectedModel.name}
        </span>
        <ChevronDown size={16} className={clsx(
          'text-gray-600 dark:text-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-20">
            <div className="p-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onSelectModel(model)
                    setIsOpen(false)
                  }}
                  className={clsx(
                    'w-full flex items-start gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                    selectedModel.id === model.id
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {model.name}
                    </div>
                    {model.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {model.description}
                      </div>
                    )}
                    {model.capabilities && model.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {model.capabilities.map((capability) => (
                          <span
                            key={capability}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                          >
                            {capability}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedModel.id === model.id && (
                    <Check size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
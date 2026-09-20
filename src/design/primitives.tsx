import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import './primitives.css'

/** 主/次/危险按钮 */
export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button className={`k-btn k-btn--${variant}${size !== 'md' ? ` k-btn--${size}` : ''} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function IconButton({ className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`k-icon-btn ${className}`} {...rest}>
      {children}
    </button>
  )
}

/** 状态/分类小标签 */
export function Tag({ tone = 'default', children }: { tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  return <span className={`k-tag${tone !== 'default' ? ` k-tag--${tone}` : ''}`}>{children}</span>
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`k-field ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`k-field ${className}`} {...rest} />
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="k-empty">{children}</div>
}

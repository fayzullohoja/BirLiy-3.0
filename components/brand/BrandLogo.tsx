import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: number
  className?: string
  alt?: string
  priority?: boolean
}

export default function BrandLogo({
  size = 48,
  className,
  alt = 'BirLiy logo',
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo-birliy-small.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 select-none', className)}
    />
  )
}

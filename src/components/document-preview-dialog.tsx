import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface DocumentPreviewDialogProps {
  fileUrl: string
  fileName?: string
  triggerLabel?: string
  triggerVariant?: 'default' | 'secondary' | 'outline' | 'ghost'
  triggerClassName?: string
}

export function DocumentPreviewDialog({
  fileUrl,
  fileName = 'Document',
  triggerLabel = 'Preview',
  triggerVariant = 'outline',
  triggerClassName,
}: DocumentPreviewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm" className={triggerClassName}>
          <FileText className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{fileName}</DialogTitle>
          <DialogDescription>Document preview</DialogDescription>
        </DialogHeader>

        <div className="h-[70vh] overflow-hidden rounded-md border">
          <iframe src={fileUrl} title={fileName} className="h-full w-full" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

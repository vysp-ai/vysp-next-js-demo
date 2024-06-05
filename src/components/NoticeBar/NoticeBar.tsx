import React from 'react'

import { Space } from 'antd'
export interface NoticeBarProps {
  className?: string
}
const NoticeBar = (props: NoticeBarProps) => {
  const { className } = props

  return (
    <Space direction="vertical" style={{ display: 'flex' }} size={[46, 10]}>

      <span><strong>{process.env.NEXT_PUBLIC_HELP_TEXT ? "Notice: " : ""}</strong>{process.env.NEXT_PUBLIC_NOTICE_TEXT ?? process.env.NEXT_PUBLIC_NOTICE_TEXT}</span>
      <span style={{width: "100px", textAlign: "left"}}><strong>{process.env.NEXT_PUBLIC_HELP_TEXT ? "How To Use: " : ""}</strong>{process.env.NEXT_PUBLIC_HELP_TEXT ??  process.env.NEXT_PUBLIC_HELP_TEXT}</span>

    </Space>
  )
}

export default NoticeBar

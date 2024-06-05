import React from 'react'

import { Space } from 'antd'
export interface VersionBarProps {
  className?: string
}
const VersionBar = (props: VersionBarProps) => {
  const { className } = props

  return (
    <Space className={className} size={[46, 0]}>
      <a href='https://vysp.ai'><span>VYSP.AI</span></a>
    </Space>
  )
}

export default VersionBar

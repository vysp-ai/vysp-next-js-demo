import React from 'react'

import { Layout } from 'antd'

import NoticeBar from './NoticeBar'
import {Space} from 'antd'
import styles from './index.module.less'

const { Content } = Layout

const Notice = () => {
  return (
    <Content className={styles.notice}>
      <Space direction="vertical" style={{ display: 'flex' }} size={[46, 0]}>
      <NoticeBar className={styles.noticeBar} />
      </Space>
    </Content>
  )
}

export default Notice

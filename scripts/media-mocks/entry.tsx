import { createRoot } from 'react-dom/client'

import { MOCKS } from './mocks'

const name = new URLSearchParams(location.search).get('m') ?? ''
const mock = MOCKS[name]
const root = createRoot(document.getElementById('root')!)
const Mock = mock?.component
root.render(Mock ? <Mock /> : <p>Unknown mock: {name}</p>)

import { useTheme, pageTitleStyle } from '@/styles/tokens'

export default function PyG() {
  const { T } = useTheme()
  return (
    <div style={{ padding: 28 }}>
      <h1 style={pageTitleStyle(T)}>PyG</h1>
      <p style={{ color: T.mut, fontSize: 13 }}>Módulo PyG — próximamente</p>
    </div>
  )
}

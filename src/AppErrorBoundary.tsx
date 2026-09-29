import { Component, type ReactNode } from 'react'

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="card" role="alert">
      <h1>No pudimos mostrar esta pantalla</h1>
      <p>Los cambios que no llegaste a guardar pueden perderse al recargar. Si estabas guardando un pago o entrenamiento, revisá el historial antes de volver a cargarlo.</p>
      <button type="button" onClick={() => window.location.reload()}>Recargar aplicación</button>
      <p>Si vuelve a ocurrir, anotá la hora y qué estabas haciendo para poder revisar el problema. No compartas contraseñas ni enlaces de acceso.</p>
    </main>
  }
}

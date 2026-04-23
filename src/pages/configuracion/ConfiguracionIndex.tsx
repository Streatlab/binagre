import { Link } from 'react-router-dom'
import { useIsDark } from '@/hooks/useIsDark'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { BigCard } from '@/components/configuracion/BigCard'

const SECCIONES = [
  { path: '/configuracion/marcas',   titulo: 'Marcas',            desc: 'Portfolio, accesos plataformas y canales de venta' },
  { path: '/configuracion/bancos',   titulo: 'Bancos y cuentas',  desc: 'Cuentas bancarias, categorías contables y reglas de conciliación' },
  { path: '/configuracion/compras',  titulo: 'Compras',           desc: 'Costes, proveedores, categorías y unidades' },
  { path: '/configuracion/usuarios', titulo: 'Usuarios',          desc: 'Accesos al ERP y matriz de permisos' },
]

export default function ConfiguracionIndex() {
  const isDark = useIsDark()
  const subtle = isDark ? '#aaa' : '#6E6656'

  return (
    <div>
      <ModTitle>Configuración</ModTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {SECCIONES.map(s => (
          <Link
            key={s.path}
            to={s.path}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <BigCard title={s.titulo}>
              <p style={{ fontSize: 13, color: subtle, fontFamily: 'Lexend, sans-serif', margin: 0 }}>
                {s.desc}
              </p>
              <div
                style={{
                  marginTop: 12,
                  color: '#B01D23',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'Oswald, sans-serif',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Abrir →
              </div>
            </BigCard>
          </Link>
        ))}
      </div>
    </div>
  )
}

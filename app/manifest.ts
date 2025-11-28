import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portal Iglesia',
    short_name: 'Iglesia App',
    description: 'Portal de gestión de alumnos y eventos',
    start_url: '/',
    display: 'standalone', // Esto oculta la barra del navegador
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon.png', // Usará el icono que pondremos en el paso 2
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}
  async function handleGenerarZip() {
    if(!todoOk||!titularId||generando) return
    setGenerando(true)
    setErrorZip(null)
    try {
      /* responseType: 'arraybuffer' evita que el cliente Supabase parsee el ZIP como JSON */
      const { data, error } = await supabase.functions.invoke('generar-zip-gestoria', {
        body: { mes: mesSeleccionado, titular_id: titularId },
        responseType: 'arraybuffer',
      })
      if (error) {
        setErrorZip(error.message || 'Error al generar el ZIP')
        return
      }
      const blob = new Blob([data as ArrayBuffer], { type: 'application/zip' })
      const titNombre = titularKey==='ruben'?'RUBEN':'EMILIO'
      const zipName = `gestoria_${mesSeleccionado}_${titNombre}.zip`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=url; a.download=zipName; a.click()
      URL.revokeObjectURL(url)
    } catch(_) {
      setErrorZip('Error de red al generar el ZIP')
    } finally {
      setGenerando(false)
    }
  }
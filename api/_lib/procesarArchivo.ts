      const facAnthropic = await extraerFacturaAnthropic(
        file.buffer,
        tipo === 'imagen' ? 'imagen' : 'pdf',
        file.mimeType || (tipo === 'imagen' ? 'image/jpeg' : 'application/pdf'),
        textoPdfCache, // ← texto ya extraído (Tesseract/Mistral): lectura BARATA, sin visión
      )
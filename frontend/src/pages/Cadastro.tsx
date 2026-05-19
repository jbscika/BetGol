// ... no topo do arquivo
  const handleFinalizar = async () => {
    // 1. Aqui você coleta os dados dos inputs
    const dados = { nome, email, senha };

    // 2. Aqui você envia para o seu Backend (Hostinger)
    try {
      const resposta = await fetch('https://seu-dominio-da-hostinger.com/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      if (resposta.ok) {
        alert('Cadastro realizado com sucesso!');
        navigate('/login');
      } else {
        alert('Erro ao cadastrar.');
      }
    } catch (erro) {
      console.error('Erro de conexão:', erro);
    }
  };

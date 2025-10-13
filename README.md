
# Checklist AFM Operator

Aplicativo de check list para operadores de equipamentos, desenvolvido com React, Vite e TailwindCSS.

## Requisitos

- Node.js (versão 18 ou superior)
- NPM (versão 9 ou superior)
- PostgreSQL (versão 15 ou superior)

## Como instalar

### Instalação local para desenvolvimento

1. Clone o repositório
```
git clone https://github.com/seu-usuario/checklistafm-operator.git
cd checklistafm-operator
```

2. Instale as dependências
```
npm install
```

3. Inicie o servidor de desenvolvimento
```
npm run dev
```

4. Acesse o aplicativo em `http://localhost:8080`

### Instalação em ambiente de produção (Proxmox LXC)

#### Pré-requisitos
- Servidor Proxmox configurado
- Acesso de administrador ao Proxmox

#### Passo a Passo

1. **Criar um novo contêiner LXC no Proxmox**
   
   - Acesse o painel web do Proxmox
   - Clique em "Create CT" (Criar Contêiner)
   - Selecione o template "Ubuntu 22.04 Standard"
   - Configure recursos (recomendado: 2 vCPU, 2GB RAM, 20GB de disco)
   - Configure rede com IP estático
   - Complete a configuração e inicie o contêiner

2. **Instalar requisitos no contêiner LXC**

   Acesse o shell do contêiner e execute:

   ```bash
   # Atualizar o sistema
   apt update && apt upgrade -y
   
   # Instalar ferramentas básicas
   apt install -y curl git build-essential nginx
   
   # Instalar Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt install -y nodejs
   
   # Verificar instalações
   node -v
   npm -v
   ```

3. **Configurar o PostgreSQL**

   ```bash
   # Instalar PostgreSQL
   apt install -y postgresql postgresql-contrib
   
   # Iniciar e habilitar o serviço
   systemctl start postgresql
   systemctl enable postgresql
   
   # Configurar o PostgreSQL
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'sua_senha_aqui';"
   
   # Permitir conexões remotas (opcional, dependendo da sua configuração de rede)
   # Editar arquivo de configuração:
   nano /etc/postgresql/14/main/postgresql.conf
   # Alterar linha: listen_addresses = '*'
   
   # Editar arquivo pg_hba.conf
   nano /etc/postgresql/14/main/pg_hba.conf
   # Adicionar linha: host all all 0.0.0.0/0 md5
   
   # Reiniciar PostgreSQL
   systemctl restart postgresql
   ```

4. **Implantar a aplicação Checklist AFM**

   ```bash
   # Criar diretório para a aplicação
   mkdir -p /var/www/checklistafm
   cd /var/www/checklistafm
   
   # Clonar o repositório
   git clone https://github.com/seu-usuario/checklistafm-operator.git .
   
   # Instalar dependências
   npm install
   
   # Criar build de produção
   npm run build
   
   # Configurar Nginx
   cat > /etc/nginx/sites-available/checklistafm << 'EOL'
   server {
       listen 80;
       server_name _;
       
       root /var/www/checklistafm/dist;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   EOL
   
   # Habilitar o site
   ln -s /etc/nginx/sites-available/checklistafm /etc/nginx/sites-enabled/
   
   # Verificar configuração do Nginx
   nginx -t
   
   # Reiniciar Nginx
   systemctl restart nginx
   ```

5. **Criar as tabelas no banco de dados PostgreSQL**

   ```bash
   # Acessar o PostgreSQL
   sudo -u postgres psql
   
   # Executar script SQL para criar as tabelas
   CREATE TABLE operadores (
       id SERIAL PRIMARY KEY,
       nome VARCHAR(100) NOT NULL,
       cargo VARCHAR(100),
       setor VARCHAR(50)
   );
   
   CREATE TABLE equipamentos (
       id SERIAL PRIMARY KEY,
       nome VARCHAR(100) NOT NULL,
       kp VARCHAR(20),
       setor VARCHAR(50),
       capacidade VARCHAR(50),
       tipo VARCHAR(20)
   );
   
   CREATE TABLE inspecoes (
       id SERIAL PRIMARY KEY,
       data_inspecao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       id_operador INTEGER REFERENCES operadores(id),
       id_equipamento INTEGER REFERENCES equipamentos(id),
       status VARCHAR(20),
       observacoes TEXT
   );
   
   CREATE TABLE itens_inspecao (
       id SERIAL PRIMARY KEY,
       id_inspecao INTEGER REFERENCES inspecoes(id),
       item_verificado VARCHAR(100),
       resultado BOOLEAN,
       observacao TEXT
   );
   ```

6. **Configurar o aplicativo para usar o banco de dados**

   - Acesse o aplicativo pelo navegador usando o IP do seu contêiner LXC
   - Vá para a página de "Conexão ao Banco de Dados" no menu de administração
   - Preencha os detalhes de conexão com o PostgreSQL:
     - Host: localhost (ou o endereço IP do servidor PostgreSQL)
     - Porta: 5432
     - Banco de dados: postgres
     - Usuário: postgres
     - Senha: sua_senha_aqui
   - Teste a conexão e siga as instruções para criar as tabelas

7. **Acessar o aplicativo**

   - Acesse o aplicativo pelo navegador usando o IP do seu contêiner LXC
   - Por exemplo: http://192.168.1.100

## Considerações de segurança

Para um ambiente de produção, considere implementar:

1. **HTTPS/SSL**
   ```bash
   # Instalar Certbot
   apt install -y certbot python3-certbot-nginx
   
   # Obter certificado SSL e configurar automaticamente
   certbot --nginx -d seu-dominio.com
   ```

2. **Firewall**
   ```bash
   # Instalar e configurar UFW
   apt install -y ufw
   
   # Configurar regras básicas
   ufw allow ssh
   ufw allow 'Nginx Full'
   ufw enable
   ```

3. **Atualizações automáticas**
   ```bash
   # Instalar unattended-upgrades
   apt install -y unattended-upgrades
   ```

## Monitoramento e Backup

Para garantir o funcionamento contínuo do sistema, configure:

1. **Backup do banco de dados**
   ```bash
   # Criar script de backup
   nano /root/backup_db.sh
   ```
   
   Conteúdo do script:
   ```bash
   #!/bin/bash
   BACKUP_DIR="/root/backups"
   FILENAME="postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
   
   mkdir -p $BACKUP_DIR
   sudo -u postgres pg_dump postgres > $BACKUP_DIR/$FILENAME
   ```
   
   Tornar o script executável e agendar:
   ```bash
   chmod +x /root/backup_db.sh
   
   # Agendar execução diária
   (crontab -l 2>/dev/null; echo "0 3 * * * /root/backup_db.sh") | crontab -
   ```

## Suporte

Para relatar problemas ou solicitar recursos, abra uma issue no repositório do GitHub.

## Licença

[Inclua aqui informações de licença]

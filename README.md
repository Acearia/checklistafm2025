

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

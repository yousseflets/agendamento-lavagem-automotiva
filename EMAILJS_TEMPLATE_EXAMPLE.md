Exemplo de template para EmailJS

Crie um template no EmailJS com o conteúdo abaixo (use as variáveis do template):

Assunto: Novo Agendamento - {{service}} - {{date}} {{time}}

Corpo (HTML):
<p>Você recebeu um novo agendamento:</p>
<ul>
  <li><strong>Nome:</strong> {{name}}</li>
  <li><strong>Telefone:</strong> {{phone}}</li>
  <li><strong>E-mail:</strong> {{email}}</li>
  <li><strong>Serviço:</strong> {{service}}</li>
  <li><strong>Data:</strong> {{date}}</li>
  <li><strong>Horário:</strong> {{time}}</li>
</ul>

No painel do EmailJS, crie um template e adicione essas variáveis como `{{name}}`, `{{phone}}`, `{{email}}`, `{{service}}`, `{{date}}`, `{{time}}`.

Depois copie `service_id`, `template_id` e `user_id` para `src/environments/environment.ts`.

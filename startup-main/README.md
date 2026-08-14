# GestorIA

**Plataforma de gestão inteligente baseada em linguagem natural**

Projeto de TAI III e gestão de startups — 6º período.

O GestorIA é uma plataforma de gestão para pequenos negócios em que o usuário registra informações em linguagem natural, como se estivesse escrevendo em um bloco de notas. A inteligência artificial interpreta a mensagem, transforma os dados em estrutura e, após confirmação, os registros passam a alimentar o dashboard e os demais recursos de gestão.

> Exemplo: *"João deixou o Corolla para trocar o óleo e fazer revisão, orçamento de 850 reais."*

A IA identifica cliente, veículo, serviços e orçamento, apresenta os dados para conferência e, depois da aprovação, registra as informações.

## Ideia principal

Facilitar o registro e a organização das informações operacionais de pequenos negócios, reduzindo o preenchimento manual de formulários e sistemas complexos.

```
Linguagem natural → IA → Dados estruturados → Gestão
```

## Problema

Pequenas empresas frequentemente usam WhatsApp, grupos internos, blocos de notas, cadernos, planilhas ou mensagens para si mesmas para registrar pedidos, serviços, clientes, entregas, agendamentos e orçamentos.

Essas ferramentas são práticas, mas as informações ficam desestruturadas: fica difícil acompanhar a operação, buscar dados, gerar indicadores e tomar decisões. Sistemas tradicionais, por outro lado, exigem muitos campos e etapas — e a equipe acaba anotando de forma informal.

## Solução

O GestorIA funciona como um **bloco de notas inteligente**. O usuário escreve livremente o que precisa registrar. A IA identifica a intenção e as informações relevantes, apresenta os dados estruturados para conferência, e o usuário confirma ou edita antes de armazenar.

### Exemplo

**Entrada:** *"Maria pediu dois bolos de chocolate de 2kg para sábado por 160 reais."*

O sistema identifica o pedido, o cliente, o produto, a quantidade, o peso, a data de entrega e o valor. Mostra um resumo para confirmar ou editar. Depois da confirmação, o registro fica disponível para gestão.

## Adaptabilidade por segmento

A empresa seleciona o segmento no cadastro e o sistema usa esse contexto para interpretar as mensagens.

| Segmento | Exemplo de mensagem | O que a IA identifica |
| --- | --- | --- |
| Oficina mecânica | "Carlos deixou o Onix placa ABC1234 para trocar pastilhas e fazer alinhamento." | Cliente, veículo, placa, serviços, status |
| Confeitaria | "Maria pediu um bolo de chocolate de 3kg para sábado, com decoração de flores, R$ 180." | Cliente, produto, sabor, peso, decoração, data, valor |
| Salão de beleza | "Ana marcou corte e progressiva com a Paula sexta às 15h." | Cliente, serviços, profissional, data, horário, valor |
| Assistência técnica | "Carlos deixou um iPhone 13 com a tela quebrada, orçamento de 700." | Cliente, equipamento, problema, orçamento, status |

Quando a mensagem é incompleta, a IA não inventa dados: pede esclarecimento ao usuário.

## Diferenciais

- Registro em linguagem natural, sem formulários complexos.
- Adaptação a diferentes segmentos de pequenos negócios.
- A equipe não precisa mudar a forma de trabalhar: as anotações informais viram dados estruturados para gestão.

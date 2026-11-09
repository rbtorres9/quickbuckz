// Ban list: checking "Account" unchecks and disables the other restriction kinds
document.addEventListener('DOMContentLoaded', () => {
  const boxes = Array.from(document.querySelectorAll('input[name="add_kinds"]'))
  const account = boxes.find((box) => box.value === 'account')
  if (!account) return

  function update() {
    boxes.forEach((box) => {
      if (box === account) return
      if (account.checked) box.checked = false
      box.disabled = account.checked
    })
  }

  account.addEventListener('change', update)
  update()
})
document.addEventListener('DOMContentLoaded', () => {
  const outcome = document.getElementById('id_review_outcome')
  if (outcome) {
    const kindRow = document.querySelector('.form-row.field-restriction_kind')
    const untilRow = document.querySelector('.form-row.field-restriction_until')

    function updateReview() {
      const v = outcome.value
      if (kindRow) kindRow.style.display = v === 'restrict' ? '' : 'none'
      if (untilRow) untilRow.style.display = (v === 'restrict' || v === 'deactivate') ? '' : 'none'
    }

    outcome.addEventListener('change', updateReview)
    updateReview()
  }

  const picker = document.getElementById('id_target_type')
  if (!picker) return

  const postRow = document.querySelector('.form-row.field-post')
  const commentRow = document.querySelector('.form-row.field-comment')
  const authorRow = document.querySelector('.form-row.field-target_author')
  const authorIsEditable = authorRow && authorRow.querySelector('select')

  function update() {
    const type = picker.value
    if (postRow) postRow.style.display = type === 'post' ? '' : 'none'
    if (commentRow) commentRow.style.display = type === 'comment' ? '' : 'none'
    if (authorIsEditable) authorRow.style.display = type === 'profile' ? '' : 'none'
  }

  picker.addEventListener('change', update)
  update()
})
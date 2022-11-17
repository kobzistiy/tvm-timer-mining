/*
 * Paginate all accounts with positive balance (WITHOUT CURSOR).
 */
const { sleep } = require('./helper')

const query = `query MyQuery( $code_hash: String, $last_id: String, $count: Int) {
    accounts(
        filter: {
            id: { gt: $last_id }
            balance: { ne: null }
            code_hash: { eq: $code_hash }
        }
        orderBy: [{ path: "id", direction: ASC }]
        limit: $count
    ) {
        id
        balance
        boc
    }
}`

async function allAccounts(client, { codeHash, itemsPerPage, pagesLimit }) {
    let accounts = []
  
    const variables = {
        code_hash: codeHash,
        count: itemsPerPage,
        last_id: null,
    }
    
    for (let pageNum = 1; ; pageNum++) {
        const response = await client.net.query({ query, variables })

        const results = response.result.data.accounts

        if (results.length) {
            accounts = accounts.concat(results)
        } else {
            break
        }
        if (pageNum === pagesLimit) {
            console.log('Page limit reached')
            break
        }

        variables.last_id = results[results.length - 1].id

        // Don't send API requests too aggressively
        await sleep(200)
    }
    return accounts;
}

module.exports = allAccounts
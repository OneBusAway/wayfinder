const MAX_AGE = 60 * 60 * 24 * 365; // 1 year
/*
@param {string} name
@returns {string | undefined} 
*/
export function getCookie(name) {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop().split(';').shift();
}
/*
@returns {string}
*/
export function getUserId() {
	let userId = getCookie('userId');
	if (!userId) {
		userId = crypto.randomUUID();
		//! Set cookie for 1 year
		document.cookie = `userId=${userId}; path=/; max-age=${MAX_AGE}`;
	}
	return userId;
}

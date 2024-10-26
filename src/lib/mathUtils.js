/**
 * Converts from OBA orientation to direction.
 *
 * From OBA REST API docs for trip status (open)
 * : "orientation - ...0º is east, 90º is north, 180º is west, and 270º is south."
 *
 * @param orientation 0º is east, 90º is north, 180º is west, and 270º is south
 * @return direction, where 0º is north, 90º is east, 180º is south, and 270º is west
 */

export function toDirection(orientation) {
	let direction = (-orientation + 90) % 360;
	if (direction < 0) {
		direction += 360;
	}

	return direction;
}
